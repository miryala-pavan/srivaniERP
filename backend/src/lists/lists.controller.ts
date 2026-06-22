import {
  Controller, Get, Post, Param, Query, Body, Res,
  UseGuards, Request, Req, Headers,
  HttpCode, BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ListsService } from './lists.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import * as crypto from 'crypto';

const WH_VERIFY_TOKEN = process.env.WA_WEBHOOK_VERIFY_TOKEN ?? 'srivani-wa-verify-2026';
const WH_APP_SECRET   = process.env.WA_APP_SECRET ?? '';

// ── WhatsApp Webhook (public — no JWT) ────────────────────────────────────────

@Controller('wa')
export class WebhookController {
  constructor(private lists: ListsService) {}

  // Meta sends a GET to verify the webhook URL
  @Get('webhook')
  @HttpCode(200)
  verify(
    @Query('hub.mode')         mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge')    challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && token === WH_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // Meta sends POST with message data
  @Post('webhook')
  @HttpCode(200)
  async receive(
    @Req()     req: any,
    @Headers('x-hub-signature-256') sig: string,
    @Body()    body: any,
  ) {
    // Verify signature if app secret is configured
    if (WH_APP_SECRET && sig) {
      const expected = 'sha256=' + crypto
        .createHmac('sha256', WH_APP_SECRET)
        .update((req as any).rawBody ?? Buffer.alloc(0))
        .digest('hex');
      if (expected !== sig) throw new BadRequestException('Invalid signature');
    }

    // Meta always expects 200 quickly — process async
    this.processWebhook(body).catch(() => null);
    return { status: 'ok' };
  }

  private async processWebhook(body: any) {
    try {
      const entry   = body?.entry?.[0];
      const changes = entry?.changes?.[0]?.value;
      if (!changes?.messages?.length) return;

      const contact = changes.contacts?.[0];
      const msg     = changes.messages[0];

      const senderPhone = msg.from as string;        // e.g. "919382828484"
      const senderName  = contact?.profile?.name as string | undefined;

      // Hardcode businessId — with multi-tenant, use WABA ID to look up
      const businessId  = process.env.DEFAULT_BUSINESS_ID ?? '';
      if (!businessId) return;

      if (msg.type === 'text') {
        await this.lists.handleIncoming(businessId, {
          senderPhone, senderName,
          msgType: 'TEXT',
          rawText: msg.text?.body as string,
        });

      } else if (msg.type === 'image') {
        await this.lists.handleIncoming(businessId, {
          senderPhone, senderName,
          msgType:   'IMAGE',
          mediaId:   msg.image?.id as string,
          mediaMime: msg.image?.mime_type as string,
        });

      } else if (msg.type === 'document') {
        const mime     = msg.document?.mime_type as string ?? '';
        const isPdf    = mime.includes('pdf');
        await this.lists.handleIncoming(businessId, {
          senderPhone, senderName,
          msgType:   isPdf ? 'PDF' : 'DOCUMENT',
          mediaId:   msg.document?.id as string,
          mediaMime: mime,
        });
      }
    } catch (err) {
      // Log but always return 200 to Meta
    }
  }
}

// ── ERP Lists API (JWT protected) ────────────────────────────────────────────

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lists')
export class ListsController {
  constructor(private lists: ListsService) {}

  @Get()
  getLists(
    @Request() req: any,
    @Query('page')  page  = '1',
    @Query('limit') limit = '30',
  ) {
    return this.lists.getLists(req.user.businessId, Number(page), Number(limit));
  }

  @Get('pending-downloads')
  getPending(@Request() req: any) {
    return this.lists.getPendingDownloads(req.user.businessId);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Request() req: any, @Res() res: Response) {
    const { buffer, filename } = await this.lists.getDocBuffer(id, req.user.businessId);
    res.set({
      'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    res.send(buffer);
  }

  @Post(':id/reprocess')
  reprocess(@Param('id') id: string, @Request() req: any) {
    return this.lists.reprocess(id, req.user.businessId);
  }

  @Post('manual')
  manual(
    @Request() req: any,
    @Body() dto: {
      senderPhone: string;
      senderName:  string;
      text?:        string;
      imageBase64?: string;
      imageMime?:   string;
      fileBase64?:  string;   // PDF or DOCX
      fileMime?:    string;
    },
  ) {
    return this.lists.manualCreate(req.user.businessId, dto);
  }
}
