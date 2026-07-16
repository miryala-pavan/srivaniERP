import { Injectable, Logger, NotFoundException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleContactsService } from './google-contacts.service';

const SYNC_QUEUE = 'google-contacts-sync';
// Every 6 hours — a manual "Sync Now" (GoogleContactsController.syncNow)
// covers the immediate case; this just catches drift between manual runs.
const SYNC_CRON = '0 */6 * * *';

type SyncDirection = 'PUSH' | 'PULL' | 'CONFLICT' | 'NOOP';

/**
 * Field-partitioned two-way sync for contacts explicitly opted in
 * (CustomerGoogleSync.syncEnabled) — see the Google Contacts plan for the
 * concrete policy this implements:
 *   - Google-authoritative, last-write-wins on conflict: name, phone, email.
 *   - ERP-exclusive, never touched here: whatsappOptIn, creditLimit, etc.
 *   - v1 scope is exactly these 3 fields — no address/org/birthday sync.
 */
@Injectable()
export class GoogleContactsSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GoogleContactsSyncService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(private prisma: PrismaService, private google: GoogleContactsService) {}

  onModuleInit() {
    // REDIS_URL is optional elsewhere in this codebase (shop-layer caching
    // degrades silently without it) — for this feature specifically it's a
    // hard requirement, since the scheduled sync simply never fires without
    // a working queue. Warn loudly rather than fail silently.
    if (!process.env.REDIS_URL) {
      this.logger.warn('REDIS_URL not set — Google Contacts scheduled sync will not run (manual "Sync Now" still works).');
      return;
    }
    try {
      const url = new URL(process.env.REDIS_URL);
      const connection = { host: url.hostname, port: Number(url.port ?? 6379), password: url.password || undefined };

      this.queue = new Queue(SYNC_QUEUE, { connection });
      this.worker = new Worker(SYNC_QUEUE, async (job) => this.syncBusiness(job.data.businessId), { connection });
      this.worker.on('failed', (job, err) => this.logger.error(`Sync job failed for business ${job?.data?.businessId}: ${err}`));

      // Repeatable job, one per business — re-adding with the same jobId is
      // idempotent (BullMQ dedupes on jobId for repeatables), so this is
      // safe to call on every boot without creating duplicate schedules.
      this.registerRepeatableJobs().catch((err) => this.logger.error(`Failed to register sync schedule: ${err}`));
    } catch (err) {
      this.logger.error(`Failed to initialize Google Contacts sync queue: ${err}`);
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  private async registerRepeatableJobs() {
    if (!this.queue) return;
    const businesses = await this.prisma.business.findMany({ where: { isActive: true }, select: { id: true } });
    for (const b of businesses) {
      await this.queue.add('sync', { businessId: b.id }, {
        repeat: { pattern: SYNC_CRON },
        jobId: `google-sync-${b.id}`,
      });
    }
  }

  // ── Opt-in toggles ───────────────────────────────────────────────────────────

  async setSyncEnabled(businessId: string, customerId: string, enabled: boolean) {
    const existing = await this.prisma.customerGoogleSync.findUnique({ where: { customerId } });
    if (existing) {
      return this.prisma.customerGoogleSync.update({ where: { customerId }, data: { syncEnabled: enabled } });
    }
    if (!enabled) return null; // never enabled, nothing to disable

    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, businessId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const result = await this.google.createContact({
      names: [{ givenName: customer.name }],
      ...(customer.phone ? { phoneNumbers: [{ value: customer.phone }] } : {}),
      ...(customer.email ? { emailAddresses: [{ value: customer.email }] } : {}),
    });
    if (![200, 201].includes(result.ok)) throw new Error(`Failed to create Google contact: ${JSON.stringify(result.data)}`);

    return this.prisma.customerGoogleSync.create({
      data: {
        businessId, customerId,
        googleResourceName: result.data.resourceName,
        googleEtag: result.data.etag,
        syncEnabled: true,
        lastSyncedAt: new Date(),
        lastSyncDirection: 'PUSH',
      },
    });
  }

  async setBulkSyncEnabled(businessId: string, customerIds: string[], enabled: boolean) {
    let succeeded = 0, failed = 0;
    for (const id of customerIds) {
      try {
        await this.setSyncEnabled(businessId, id, enabled);
        succeeded++;
      } catch (err) {
        failed++;
        this.logger.error(`Bulk sync-toggle failed for customer ${id}: ${err}`);
      }
    }
    return { requested: customerIds.length, succeeded, failed };
  }

  // ── Sync ─────────────────────────────────────────────────────────────────────

  async syncBusiness(businessId: string) {
    const rows = await this.prisma.customerGoogleSync.findMany({
      where: { businessId, syncEnabled: true },
      include: { customer: true },
    });

    let pushed = 0, pulled = 0, conflicts = 0, failed = 0, noop = 0;
    for (const row of rows) {
      try {
        const direction = await this.syncOne(row);
        if (direction === 'PUSH') pushed++;
        else if (direction === 'PULL') pulled++;
        else if (direction === 'CONFLICT') conflicts++;
        else noop++;
      } catch (err) {
        failed++;
        await this.prisma.customerGoogleSync.update({
          where: { id: row.id },
          data: { lastError: err instanceof Error ? err.message : String(err) },
        }).catch(() => {});
      }
    }
    return { total: rows.length, pushed, pulled, conflicts, noop, failed };
  }

  private async syncOne(row: { id: string; customerId: string; googleResourceName: string; googleEtag: string; lastSyncedAt: Date | null; customer: { name: string; phone: string | null; email: string | null; updatedAt: Date } }): Promise<SyncDirection> {
    const remote = await this.google.getContact(row.googleResourceName);
    if (remote.ok !== 200) throw new Error(`Failed to fetch Google contact: ${JSON.stringify(remote.data)}`);

    const remoteUpdateTime = remote.data?.metadata?.sources?.[0]?.updateTime ? new Date(remote.data.metadata.sources[0].updateTime) : null;
    const lastSyncedAt = row.lastSyncedAt;
    const localChanged = !lastSyncedAt || row.customer.updatedAt > lastSyncedAt;
    const remoteChanged = !lastSyncedAt || (!!remoteUpdateTime && remoteUpdateTime > lastSyncedAt);

    if (!localChanged && !remoteChanged) return 'NOOP';

    if (localChanged && remoteChanged) {
      // Genuine conflict — newer timestamp wins, recorded (not silently overwritten).
      const pullWins = !!remoteUpdateTime && remoteUpdateTime > row.customer.updatedAt;
      if (pullWins) await this.pullToLocal(row, remote.data);
      else await this.pushToGoogle(row, remote.data.etag);
      await this.prisma.customerGoogleSync.update({
        where: { id: row.id },
        data: { lastSyncedAt: new Date(), lastSyncDirection: 'CONFLICT', lastError: `Conflict resolved via ${pullWins ? 'PULL' : 'PUSH'} (newer timestamp won)` },
      });
      return 'CONFLICT';
    }

    if (remoteChanged) {
      await this.pullToLocal(row, remote.data);
      await this.prisma.customerGoogleSync.update({ where: { id: row.id }, data: { lastSyncedAt: new Date(), lastSyncDirection: 'PULL', lastError: null } });
      return 'PULL';
    }

    await this.pushToGoogle(row, remote.data.etag);
    await this.prisma.customerGoogleSync.update({ where: { id: row.id }, data: { lastSyncedAt: new Date(), lastSyncDirection: 'PUSH', lastError: null } });
    return 'PUSH';
  }

  private async pushToGoogle(row: { id: string; googleResourceName: string; customer: { name: string; phone: string | null; email: string | null } }, currentEtag: string) {
    const body = {
      names: [{ givenName: row.customer.name }],
      ...(row.customer.phone ? { phoneNumbers: [{ value: row.customer.phone }] } : {}),
      ...(row.customer.email ? { emailAddresses: [{ value: row.customer.email }] } : {}),
    };
    let result = await this.google.updateContact(row.googleResourceName, currentEtag, body);
    if (result.ok === 409) {
      // etag mismatch — Google's copy changed since our last read. Re-pull, retry once.
      const fresh = await this.google.getContact(row.googleResourceName);
      if (fresh.ok !== 200) throw new Error('Push failed: could not re-fetch contact after etag conflict');
      result = await this.google.updateContact(row.googleResourceName, fresh.data.etag, body);
    }
    if (result.ok !== 200) throw new Error(`Push to Google failed: ${JSON.stringify(result.data)}`);
    await this.prisma.customerGoogleSync.update({ where: { id: row.id }, data: { googleEtag: result.data.etag } });
  }

  private async pullToLocal(row: { id: string; customerId: string }, remoteData: any) {
    const name  = remoteData.names?.[0]?.displayName ?? remoteData.names?.[0]?.givenName;
    const rawPhone = remoteData.phoneNumbers?.[0]?.value as string | undefined;
    const phone = rawPhone ? rawPhone.replace(/\D/g, '').slice(-10) : undefined;
    const email = remoteData.emailAddresses?.[0]?.value as string | undefined;

    await this.prisma.customer.update({
      where: { id: row.customerId },
      data: {
        ...(name  ? { name } : {}),
        ...(phone && /^[6-9]\d{9}$/.test(phone) ? { phone } : {}),
        ...(email ? { email } : {}),
      },
    });
    await this.prisma.customerGoogleSync.update({ where: { id: row.id }, data: { googleEtag: remoteData.etag } });
  }
}
