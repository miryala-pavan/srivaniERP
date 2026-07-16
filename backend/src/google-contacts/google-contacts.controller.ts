import { Controller, Get, Post, Patch, Query, Body, Param, Res, UseGuards, Request, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import * as crypto from 'crypto';
import { GoogleContactsService } from './google-contacts.service';
import { GoogleContactsSyncService } from './google-contacts-sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

function signState(businessId: string): string {
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = `${businessId}:${nonce}`;
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET ?? '').update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyState(state: string): { businessId: string } | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const [businessId, nonce, sig] = decoded.split(':');
    if (!businessId || !nonce || !sig) return null;
    const expected = crypto.createHmac('sha256', process.env.JWT_SECRET ?? '').update(`${businessId}:${nonce}`).digest('hex');
    return sig === expected ? { businessId } : null;
  } catch {
    return null;
  }
}

@Controller('google-contacts')
export class GoogleContactsController {
  constructor(
    private google: GoogleContactsService,
    private sync: GoogleContactsSyncService,
  ) {}

  // ── OAuth (start is authenticated; callback is Google's redirect — no JWT) ──

  // Returns the consent URL as JSON rather than issuing a server-side
  // redirect — this route is JwtAuthGuard-protected via a Bearer token the
  // frontend's axios client attaches, which a plain browser navigation/link
  // click would never carry (it's not a cookie). The frontend fetches this
  // via its authenticated api client, then does the actual navigation
  // itself with window.location.href.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Get('oauth/start')
  start(@Request() req: any) {
    return { url: this.google.buildConsentUrl(signState(req.user.businessId)) };
  }

  // No JwtAuthGuard — Google redirects the user's browser here directly with
  // no auth header, only the signed `state` we generated in start() above.
  @Get('oauth/callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string, @Res() res: Response) {
    const verified = state ? verifyState(state) : null;
    if (error || !code || !verified) {
      return res.redirect(`/dashboard/notifications/whatsapp?tab=settings&googleContactsError=1`);
    }
    try {
      await this.google.handleOAuthCallback(verified.businessId, code);
      return res.redirect(`/dashboard/notifications/whatsapp?tab=settings&googleContactsConnected=1`);
    } catch {
      return res.redirect(`/dashboard/notifications/whatsapp?tab=settings&googleContactsError=1`);
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Get('credentials')
  getCredentials() {
    return this.google.getCredentials();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post('disconnect')
  disconnect(@Request() req: any) {
    return this.google.disconnect(req.user.businessId);
  }

  // ── Sync ─────────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post('sync/now')
  syncNow(@Request() req: any) {
    return this.sync.syncBusiness(req.user.businessId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Patch('customers/:id/sync-enabled')
  setSyncEnabled(@Request() req: any, @Param('id') id: string, @Body('enabled') enabled: boolean) {
    if (typeof enabled !== 'boolean') throw new BadRequestException('enabled must be a boolean');
    return this.sync.setSyncEnabled(req.user.businessId, id, enabled);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('customers/bulk/sync-enabled')
  setBulkSyncEnabled(@Request() req: any, @Body() body: { ids: string[]; enabled: boolean }) {
    if (!Array.isArray(body.ids) || typeof body.enabled !== 'boolean') throw new BadRequestException('ids[] and enabled are required');
    return this.sync.setBulkSyncEnabled(req.user.businessId, body.ids, body.enabled);
  }
}
