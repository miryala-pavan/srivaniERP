import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';
import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  AlignmentType, LevelFormat,
} from 'docx';

const LISTS_DIR = process.env.LISTS_DIR ?? path.join(process.cwd(), '..', 'storage', 'lists');

@Injectable()
export class ListsService {
  private readonly logger = new Logger(ListsService.name);

  constructor(private prisma: PrismaService) {}

  // ── Webhook: auto-save contact + queue list ────────────────────────────────

  async handleIncoming(businessId: string, payload: {
    senderPhone: string;
    senderName?: string;
    msgType: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'PDF';
    rawText?: string;
    mediaId?: string;
    mediaMime?: string;
  }) {
    // Auto-upsert contact
    if (payload.senderName) {
      await this.upsertContact(businessId, payload.senderPhone, payload.senderName);
    }

    const record = await this.prisma.waIncomingList.create({
      data: {
        businessId,
        senderPhone: payload.senderPhone,
        senderName:  payload.senderName,
        msgType:     payload.msgType,
        rawText:     payload.rawText,
        mediaId:     payload.mediaId,
        mediaMime:   payload.mediaMime,
        status:      'PENDING',
      },
    });

    // Process asynchronously — don't await
    this.processRecord(record.id, businessId).catch(err =>
      this.logger.error(`Process failed for ${record.id}: ${err}`)
    );

    return record;
  }

  private async upsertContact(businessId: string, phone: string, name: string) {
    try {
      const existing = await this.prisma.customer.findFirst({
        where: { businessId, phone: { contains: phone.slice(-10) } },
      });
      if (!existing) {
        await this.prisma.customer.create({
          data: {
            businessId,
            name,
            phone: phone.replace(/^91/, ''),
            channel: 'ONLINE',
          },
        });
        this.logger.log(`Auto-created contact: ${name} (${phone})`);
      }
    } catch (err) {
      this.logger.warn(`Could not auto-save contact: ${err}`);
    }
  }

  // ── Core processing ────────────────────────────────────────────────────────

  async processRecord(id: string, businessId: string) {
    await this.prisma.waIncomingList.update({ where: { id }, data: { status: 'PROCESSING' } });

    try {
      const record = await this.prisma.waIncomingList.findUnique({ where: { id } });
      if (!record) return;

      let textLines: string[] | null = null;
      let imageBuffer: Buffer | null = null;

      if (record.msgType === 'TEXT' && record.rawText) {
        textLines = record.rawText
          .split('\n')
          .map(l => l.trim())
          .filter(Boolean);

      } else if (record.msgType === 'IMAGE' && record.mediaId) {
        const raw = await this.downloadMedia(record.mediaId);
        imageBuffer = await this.processImage(raw);

        // The printable doc always embeds the cleaned image (faithful, no OCR
        // errors). OCR text is captured alongside as a searchable reference.
        const ocr = await this.runOcr(imageBuffer);
        if (ocr) {
          await this.prisma.waIncomingList.update({ where: { id }, data: { ocrText: ocr } });
        }

      } else if ((record.msgType === 'DOCUMENT' || record.msgType === 'PDF') && record.mediaId) {
        const raw = await this.downloadMedia(record.mediaId);
        if (record.mediaMime === 'application/pdf') {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
          const parsed = await pdfParse(raw);
          textLines = parsed.text.split('\n').map(l => l.trim()).filter(Boolean);
        } else {
          // Non-PDF document — treat as image
          imageBuffer = await this.processImage(raw);
        }
      }

      // Generate .docx
      const displayName = record.senderName ?? record.senderPhone;
      const phone       = record.senderPhone.replace(/^91/, '');
      const docPath     = await this.generateDoc(businessId, displayName, phone, textLines, imageBuffer, record.receivedAt);

      await this.prisma.waIncomingList.update({
        where: { id },
        data:  { docPath, docReady: true, status: 'READY', processedAt: new Date() },
      });
      this.logger.log(`List ${id} ready → ${docPath}`);

    } catch (err) {
      await this.prisma.waIncomingList.update({
        where: { id },
        data:  { status: 'PENDING', errorMsg: String(err) },
      });
      throw err;
    }
  }

  // ── Media download from Meta API ───────────────────────────────────────────

  private async downloadMedia(mediaId: string): Promise<Buffer> {
    const token = process.env.WA_ACCESS_TOKEN;
    if (!token) throw new Error('WA_ACCESS_TOKEN not set');

    // Step 1: get the download URL
    const metaRes = await fetch(`https://graph.facebook.com/v25.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) throw new Error(`Meta media URL fetch failed: ${metaRes.status}`);
    const meta = await metaRes.json() as { url: string };

    // Step 2: download the file
    const fileRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!fileRes.ok) throw new Error(`Media download failed: ${fileRes.status}`);
    return Buffer.from(await fileRes.arrayBuffer());
  }

  // ── Image processing — print-friendly "scan" cleanup ──────────────────────
  // Handles dark backgrounds and dull/faint handwriting:
  //   • grayscale
  //   • CLAHE — local adaptive contrast: brightens dark patches, lifts faint ink
  //   • normalize — global contrast stretch
  //   • linear (levels) — crush background to white, keep ink dark
  //   • sharpen — crisp edges
  // Returns a PNG (crisper for line-art/handwriting than JPEG).
  private async processImage(input: Buffer): Promise<Buffer> {
    const sharp = (await import('sharp')).default;
    return sharp(input)
      .rotate()                                       // honor EXIF orientation
      .grayscale()
      .clahe({ width: 64, height: 64, maxSlope: 4 })  // even lighting + boost faint ink
      .normalize()                                    // global contrast stretch
      .linear(1.96, -88)                              // levels: bg→white, ink stays dark
      .sharpen({ sigma: 1.2 })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }

  // ── OCR ────────────────────────────────────────────────────────────────────
  // Tries Google Cloud Vision first (great at handwritten Telugu+English),
  // then falls back to tesseract.js. Returns null if neither yields usable text.
  // Either way the caller still embeds the cleaned image as a safe fallback.
  private async runOcr(imageBuffer: Buffer): Promise<string | null> {
    const vision = await this.runGoogleVision(imageBuffer);
    if (vision) return vision;
    return this.runTesseract(imageBuffer);
  }

  // Google Cloud Vision DOCUMENT_TEXT_DETECTION via REST (API key, no SDK dep).
  private async runGoogleVision(imageBuffer: Buffer): Promise<string | null> {
    const key = process.env.GOOGLE_VISION_API_KEY;
    if (!key) return null; // not configured — silently skip
    try {
      const res = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${key}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image:        { content: imageBuffer.toString('base64') },
              features:     [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              imageContext: { languageHints: ['en', 'te'] },
            }],
          }),
        },
      );
      if (!res.ok) {
        this.logger.warn(`Google Vision HTTP ${res.status}: ${await res.text()}`);
        return null;
      }
      const json = await res.json() as {
        responses?: { fullTextAnnotation?: { text?: string }; error?: { message?: string } }[];
      };
      const r = json.responses?.[0];
      if (r?.error?.message) {
        this.logger.warn(`Google Vision error: ${r.error.message}`);
        return null;
      }
      const text = r?.fullTextAnnotation?.text?.trim();
      return text || null;
    } catch (err) {
      this.logger.warn(`Google Vision failed (non-fatal): ${err}`);
      return null;
    }
  }

  private async runTesseract(imageBuffer: Buffer): Promise<string | null> {
    try {
      const { createWorker } = await import('tesseract.js');
      // Use English + Telugu; tel is available in the default tesseract.js bundle
      const worker = await createWorker(['eng', 'tel']);
      const { data: { text } } = await worker.recognize(imageBuffer);
      await worker.terminate();
      return text.trim() || null;
    } catch (err) {
      this.logger.warn(`Tesseract OCR failed (non-fatal): ${err}`);
      return null;
    }
  }

  // ── DOCX generation ───────────────────────────────────────────────────────

  private async generateDoc(
    businessId: string,
    customerName: string,
    phone: string,
    textLines: string[] | null,
    imageBuffer: Buffer | null,
    receivedAt: Date,
  ): Promise<string> {
    // Folder: LISTS_DIR/YYYY/Month YYYY/YYYYMMDD/
    const d = receivedAt;
    const monthName = d.toLocaleString('en-IN', { month: 'long' });
    const year   = d.getFullYear();
    const dateStr = `${year}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const folder = path.join(LISTS_DIR, String(year), `${monthName} ${year}`, dateStr);
    fs.mkdirSync(folder, { recursive: true });

    const filename = `${customerName}  ${phone}.docx`;
    const filePath = path.join(folder, filename);

    const headerLine = `${customerName}  ${phone}`;

    const children: Paragraph[] = [
      new Paragraph({
        children: [new TextRun({ text: headerLine, font: 'Times New Roman', size: 32 })],
        spacing:  { after: 0 },
      }),
    ];

    if (textLines && textLines.length > 0) {
      // Numbered list
      for (const line of textLines) {
        children.push(
          new Paragraph({
            numbering: { reference: 'list', level: 0 },
            children:  [new TextRun({ text: line, font: 'Times New Roman', size: 24 })],
            spacing:   { after: 40 },
          }),
        );
      }
    } else if (imageBuffer) {
      // Embed processed image — A4 content width ≈ 520pt → scale to fit
      const sharp = (await import('sharp')).default;
      const meta  = await sharp(imageBuffer).metadata();
      const maxW  = 480; // points
      const ratio = meta.width ? Math.min(1, maxW / meta.width) : 1;
      const w     = Math.round((meta.width  ?? maxW) * ratio);
      const h     = Math.round((meta.height ?? 600)  * ratio);

      children.push(
        new Paragraph({
          children: [new ImageRun({
            type: 'png',
            data: imageBuffer,
            transformation: { width: w, height: h },
            altText: { title: 'Order list', description: 'Customer order list', name: 'list' },
          })],
        }),
      );
    }

    const doc = new Document({
      numbering: {
        config: [{
          reference: 'list',
          levels: [{
            level: 0,
            format: LevelFormat.DECIMAL,
            text: '%1.',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        }],
      },
      sections: [{
        properties: {
          page: {
            size:   { width: 11906, height: 16838 },  // A4
            margin: { top: 1418, right: 1269, bottom: 1418, left: 1560 },
          },
        },
        children,
      }],
    });

    const buf = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buf);
    return filePath;
  }

  // ── List CRUD for ERP ──────────────────────────────────────────────────────

  async getLists(businessId: string, page = 1, limit = 30) {
    const skip  = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.waIncomingList.findMany({
        where:   { businessId },
        orderBy: { receivedAt: 'desc' },
        skip, take: limit,
      }),
      this.prisma.waIncomingList.count({ where: { businessId } }),
    ]);
    return { items, total, page, limit };
  }

  async getDocBuffer(id: string, businessId: string): Promise<{ buffer: Buffer; filename: string }> {
    const record = await this.prisma.waIncomingList.findFirst({ where: { id, businessId } });
    if (!record?.docPath) throw new Error('Document not ready');

    await this.prisma.waIncomingList.update({
      where: { id },
      data:  { status: 'DOWNLOADED' },
    });

    const filename = path.basename(record.docPath);
    return { buffer: fs.readFileSync(record.docPath), filename };
  }

  // For the local Windows sync script — returns undownloaded docs
  async getPendingDownloads(businessId: string) {
    return this.prisma.waIncomingList.findMany({
      where:   { businessId, docReady: true, status: { in: ['READY'] } },
      orderBy: { receivedAt: 'asc' },
      select:  { id: true, senderName: true, senderPhone: true, receivedAt: true, docPath: true },
    });
  }

  // Manual reprocess (in case of error)
  async reprocess(id: string, businessId: string) {
    const r = await this.prisma.waIncomingList.findFirst({ where: { id, businessId } });
    if (!r) throw new Error('Not found');
    await this.prisma.waIncomingList.update({ where: { id }, data: { status: 'PENDING', errorMsg: null } });
    this.processRecord(id, businessId).catch(() => null);
    return { queued: true };
  }

  // ── Text extraction from uploaded files ───────────────────────────────────

  async extractTextFromFile(buffer: Buffer, mime: string): Promise<string[]> {
    if (mime === 'application/pdf') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
      const result   = await pdfParse(buffer);
      return result.text.split('\n').map(l => l.trim()).filter(Boolean);
    }

    if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mime === 'application/msword') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth') as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> };
      const result  = await mammoth.extractRawText({ buffer });
      return result.value.split('\n').map(l => l.trim()).filter(Boolean);
    }

    throw new Error(`Unsupported file type: ${mime}`);
  }

  // ── Manual create from ERP (text / image / PDF / DOCX) ────────────────────

  async manualCreate(businessId: string, dto: {
    senderPhone:  string;
    senderName:   string;
    text?:        string;
    imageBase64?: string;
    imageMime?:   string;
    fileBase64?:  string;   // PDF or DOCX
    fileMime?:    string;
  }) {
    const now  = new Date();
    const phone = dto.senderPhone.replace(/\D/g, '').replace(/^91/, '');

    // ── Case 1: plain text ────────────────────────────────────────────────
    if (dto.text) {
      const textLines = dto.text.split('\n').map(l => l.trim()).filter(Boolean);
      const docPath   = await this.generateDoc(businessId, dto.senderName, phone, textLines, null, now);
      return this.prisma.waIncomingList.create({
        data: {
          businessId, senderPhone: dto.senderPhone, senderName: dto.senderName,
          msgType: 'TEXT', rawText: dto.text,
          docPath, docReady: true, status: 'READY', processedAt: now,
        },
      });
    }

    // ── Case 2: PDF or DOCX ───────────────────────────────────────────────
    if (dto.fileBase64 && dto.fileMime) {
      const buf       = Buffer.from(dto.fileBase64, 'base64');
      const textLines = await this.extractTextFromFile(buf, dto.fileMime);
      const isPdf     = dto.fileMime.includes('pdf');
      const docPath   = await this.generateDoc(businessId, dto.senderName, phone, textLines, null, now);
      return this.prisma.waIncomingList.create({
        data: {
          businessId, senderPhone: dto.senderPhone, senderName: dto.senderName,
          msgType: isPdf ? 'PDF' : 'DOCUMENT', mediaMime: dto.fileMime,
          rawText: textLines.join('\n'),
          docPath, docReady: true, status: 'READY', processedAt: now,
        },
      });
    }

    // ── Case 3: image ─────────────────────────────────────────────────────
    if (dto.imageBase64 && dto.imageMime) {
      const raw       = Buffer.from(dto.imageBase64, 'base64');
      const processed = await this.processImage(raw);
      // Always embed the cleaned image (faithful print); OCR is reference only.
      const ocr       = await this.runOcr(processed);
      const docPath   = await this.generateDoc(businessId, dto.senderName, phone, null, processed, now);
      return this.prisma.waIncomingList.create({
        data: {
          businessId, senderPhone: dto.senderPhone, senderName: dto.senderName,
          msgType: 'IMAGE', mediaMime: dto.imageMime,
          ocrText: ocr ?? undefined,
          docPath, docReady: true, status: 'READY', processedAt: now,
        },
      });
    }

    throw new Error('Provide text, image, PDF, or DOCX');
  }
}
