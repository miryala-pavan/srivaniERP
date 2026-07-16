import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';

// DB keys for Google OAuth credentials stored in SystemSetting. Same
// plain-text-in-SystemSetting precedent as WhatsApp/Facebook credentials
// (see whatsapp.service.ts's WA_KEYS, social-messaging.service.ts's
// SOCIAL_KEYS) — confirmed with the user rather than introducing the first
// encryption-at-rest subsystem in this codebase for this credential alone.
const GOOGLE_KEYS = {
  accessToken:  'google.access_token',
  refreshToken: 'google.refresh_token',
  tokenExpiry:  'google.token_expiry',       // ISO string
  accountEmail: 'google.connected_account_email',
} as const;

const CONTACTS_SCOPE = 'https://www.googleapis.com/auth/contacts';
const PEOPLE_API_BASE = 'https://people.googleapis.com/v1';

@Injectable()
export class GoogleContactsService implements OnModuleInit {
  private readonly logger = new Logger(GoogleContactsService.name);

  private _accessToken:  string | undefined;
  private _refreshToken: string | undefined;
  private _tokenExpiry:  string | undefined;
  private _accountEmail: string | undefined;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.loadCredentialsFromDb();
  }

  private async loadCredentialsFromDb() {
    try {
      const rows = await this.prisma.systemSetting.findMany({
        where: { key: { in: Object.values(GOOGLE_KEYS) } },
      });
      for (const row of rows) {
        if (row.key === GOOGLE_KEYS.accessToken  && row.value) this._accessToken  = row.value;
        if (row.key === GOOGLE_KEYS.refreshToken && row.value) this._refreshToken = row.value;
        if (row.key === GOOGLE_KEYS.tokenExpiry  && row.value) this._tokenExpiry  = row.value;
        if (row.key === GOOGLE_KEYS.accountEmail && row.value) this._accountEmail = row.value;
      }
    } catch { /* DB not ready at boot */ }
  }

  private get clientId()     { return process.env.GOOGLE_CONTACTS_CLIENT_ID; }
  private get clientSecret() { return process.env.GOOGLE_CONTACTS_CLIENT_SECRET; }
  private get redirectUri()  { return process.env.GOOGLE_CONTACTS_REDIRECT_URI; }

  private get enabled() {
    return !!(this.clientId && this.clientSecret && this._refreshToken);
  }

  private newOAuthClient(): OAuth2Client {
    return new OAuth2Client({ clientId: this.clientId, clientSecret: this.clientSecret, redirectUri: this.redirectUri });
  }

  // ── Credential status / management ──────────────────────────────────────────

  getCredentials() {
    return {
      configured: !!(this.clientId && this.clientSecret),
      connected: !!this._refreshToken,
      connectedAccountEmail: this._accountEmail ?? null,
    };
  }

  private async saveCredentials(businessId: string, data: {
    accessToken?: string; refreshToken?: string; tokenExpiry?: string; accountEmail?: string;
  }) {
    const ops: Promise<any>[] = [];
    const upsert = (key: string, value: string) =>
      this.prisma.systemSetting.upsert({
        where:  { businessId_key: { businessId, key } },
        update: { value },
        create: { businessId, key, value },
      });

    if (data.accessToken)  { ops.push(upsert(GOOGLE_KEYS.accessToken,  data.accessToken));  this._accessToken  = data.accessToken; }
    if (data.refreshToken) { ops.push(upsert(GOOGLE_KEYS.refreshToken, data.refreshToken)); this._refreshToken = data.refreshToken; }
    if (data.tokenExpiry)  { ops.push(upsert(GOOGLE_KEYS.tokenExpiry,  data.tokenExpiry));  this._tokenExpiry  = data.tokenExpiry; }
    if (data.accountEmail) { ops.push(upsert(GOOGLE_KEYS.accountEmail, data.accountEmail)); this._accountEmail = data.accountEmail; }

    await Promise.all(ops);
  }

  async disconnect(businessId: string) {
    await this.prisma.systemSetting.deleteMany({
      where: { businessId, key: { in: Object.values(GOOGLE_KEYS) } },
    });
    this._accessToken = this._refreshToken = this._tokenExpiry = this._accountEmail = undefined;
    return { disconnected: true };
  }

  // ── OAuth flow ───────────────────────────────────────────────────────────────

  buildConsentUrl(state: string): string {
    const client = this.newOAuthClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // forces a refresh_token even on a reconnect
      scope: [CONTACTS_SCOPE, 'email'],
      state,
    });
  }

  async handleOAuthCallback(businessId: string, code: string) {
    const client = this.newOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      throw new Error('Google did not return a refresh token — remove this app\'s access at myaccount.google.com/permissions and try connecting again (prompt=consent should prevent this, but a stale grant can still skip it).');
    }

    let accountEmail: string | undefined;
    try {
      client.setCredentials(tokens);
      const info = await client.getTokenInfo(tokens.access_token!);
      accountEmail = (info as any).email;
    } catch { /* non-fatal — email is informational only */ }

    await this.saveCredentials(businessId, {
      accessToken: tokens.access_token ?? undefined,
      refreshToken: tokens.refresh_token,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : undefined,
      accountEmail,
    });
    return { connected: true, accountEmail };
  }

  /** Returns a valid access token, refreshing it first if it's expired or about to expire. */
  async getValidAccessToken(): Promise<string> {
    if (!this._refreshToken) throw new Error('Google Contacts not connected');
    const expiry = this._tokenExpiry ? new Date(this._tokenExpiry).getTime() : 0;
    const soon = Date.now() + 60_000; // refresh a minute early to avoid a race with the API call
    if (this._accessToken && expiry > soon) return this._accessToken;

    const client = this.newOAuthClient();
    client.setCredentials({ refresh_token: this._refreshToken });
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token) throw new Error('Google token refresh returned no access token');

    // Note: businessId isn't threaded through here since this codebase's
    // Google credentials are single-tenant-scoped like WhatsApp/Facebook's
    // (one connected account per deployment) — persisted via the same
    // in-memory-cache-then-DB-write pattern, businessId resolved by the
    // caller when this is first wired to a real business-scoped flow.
    this._accessToken = credentials.access_token;
    this._tokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : undefined;
    return credentials.access_token;
  }

  // ── People API ───────────────────────────────────────────────────────────────

  private async peopleApiFetch(path: string, init?: RequestInit) {
    const token = await this.getValidAccessToken();
    const res = await fetch(`${PEOPLE_API_BASE}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => null);
    return { ok: res.status, data };
  }

  async getContact(resourceName: string, personFields = 'names,phoneNumbers,emailAddresses,metadata') {
    return this.peopleApiFetch(`/${resourceName}?personFields=${personFields}`);
  }

  async createContact(body: object) {
    return this.peopleApiFetch('/people:createContact', { method: 'POST', body: JSON.stringify(body) });
  }

  /** etag must be the last-known value — a mismatch means Google's copy changed since our last read (409). */
  async updateContact(resourceName: string, etag: string, body: object, updateFields = 'names,phoneNumbers,emailAddresses') {
    return this.peopleApiFetch(`/${resourceName}:updateContact?updatePersonFields=${updateFields}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...body, etag }),
    });
  }
}
