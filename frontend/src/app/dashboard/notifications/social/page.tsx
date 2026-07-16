'use client';

import { useState, useEffect } from 'react';
import {
  Camera, MessagesSquare, MessageCircle as CommentIcon, Settings as SettingsIcon,
  Wifi, WifiOff, Plus, Trash2, Pencil, Globe,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { FieldHelp } from '@/components/ui/FieldHelp';
import SocialChat from './SocialChat';

interface PageAccount {
  id: string; label: string; pageId: string; igBusinessAccountId: string | null;
  isActive: boolean; createdAt: string;
}
interface CommentCampaign {
  id: string; channel: 'FACEBOOK' | 'INSTAGRAM'; postId: string | null;
  triggerKeyword: string; replyMessage: string; isActive: boolean;
}
const BLANK_PAGE_FORM = { label: '', pageAccessToken: '', pageId: '', igBusinessAccountId: '' };
const BLANK_CAMPAIGN_FORM = { channel: 'FACEBOOK' as 'FACEBOOK' | 'INSTAGRAM', postId: '', triggerKeyword: '', replyMessage: '' };

export default function SocialPage() {
  const isSuperAdmin = getUser<{ role: string }>()?.role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<'inbox' | 'campaigns' | 'settings'>('inbox');

  const [credsStatus, setCredsStatus] = useState<{ tokenConfigured: boolean; pageId: string | null } | null>(null);
  const [pageAccounts, setPageAccounts] = useState<PageAccount[]>([]);
  const [pageAccountsLoaded, setPageAccountsLoaded] = useState(false);
  const [showPageForm, setShowPageForm] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [pageForm, setPageForm] = useState({ ...BLANK_PAGE_FORM });
  const [savingPage, setSavingPage] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<CommentCampaign[]>([]);
  const [campaignsLoaded, setCampaignsLoaded] = useState(false);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ ...BLANK_CAMPAIGN_FORM });
  const [savingCampaign, setSavingCampaign] = useState(false);

  async function loadCreds() {
    try {
      const { data } = await api.get('/notifications/social/credentials');
      setCredsStatus(data);
    } catch { /* ignore */ }
  }

  async function loadPageAccounts() {
    try {
      const { data } = await api.get('/notifications/social/page-accounts');
      setPageAccounts(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load saved Pages');
    } finally {
      setPageAccountsLoaded(true);
    }
  }

  async function loadCampaigns() {
    try {
      const { data } = await api.get('/notifications/social/comment-campaigns');
      setCampaigns(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load comment campaigns');
    } finally {
      setCampaignsLoaded(true);
    }
  }

  useEffect(() => {
    loadCreds();
    if (isSuperAdmin) { loadPageAccounts(); loadCampaigns(); }
  }, [isSuperAdmin]);

  async function savePageAccount() {
    if (!pageForm.label.trim() || !pageForm.pageId.trim()) {
      return toast.error('Label and Page ID are required');
    }
    if (!editingPageId && !pageForm.pageAccessToken.trim()) {
      return toast.error('Page access token is required for a new Page');
    }
    setSavingPage(true);
    try {
      const { data } = await api.post('/notifications/social/page-accounts', {
        id: editingPageId ?? undefined,
        label: pageForm.label.trim(),
        pageAccessToken: pageForm.pageAccessToken.trim() || undefined,
        pageId: pageForm.pageId.trim(),
        igBusinessAccountId: pageForm.igBusinessAccountId.trim() || undefined,
      });
      setPageAccounts(data);
      setShowPageForm(false);
      setPageForm({ ...BLANK_PAGE_FORM });
      setEditingPageId(null);
      toast.success('Page saved');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to save Page');
    } finally {
      setSavingPage(false);
    }
  }

  async function activatePageAccount(id: string) {
    setActivatingId(id);
    try {
      const { data } = await api.post(`/notifications/social/page-accounts/${id}/activate`);
      setPageAccounts(data);
      toast.success('Page activated');
      loadCreds();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to activate Page');
    } finally {
      setActivatingId(null);
    }
  }

  async function deletePageAccount(id: string, label: string) {
    if (!confirm(`Remove saved Page "${label}"? This only removes it from this list — it doesn't affect the Page on Meta.`)) return;
    try {
      const { data } = await api.delete(`/notifications/social/page-accounts/${id}`);
      setPageAccounts(data);
      toast.success('Page removed');
    } catch {
      toast.error('Failed to remove Page');
    }
  }

  async function saveCampaign() {
    if (!campaignForm.triggerKeyword.trim() || !campaignForm.replyMessage.trim()) {
      return toast.error('Trigger keyword and reply message are required');
    }
    setSavingCampaign(true);
    try {
      await api.post('/notifications/social/comment-campaigns', {
        channel: campaignForm.channel,
        postId: campaignForm.postId.trim() || undefined,
        triggerKeyword: campaignForm.triggerKeyword.trim(),
        replyMessage: campaignForm.replyMessage.trim(),
      });
      setCampaignForm({ ...BLANK_CAMPAIGN_FORM });
      setShowCampaignForm(false);
      await loadCampaigns();
      toast.success('Comment campaign saved');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to save campaign');
    } finally {
      setSavingCampaign(false);
    }
  }

  async function toggleCampaignActive(c: CommentCampaign) {
    try {
      await api.patch(`/notifications/social/comment-campaigns/${c.id}`, { isActive: !c.isActive });
      await loadCampaigns();
    } catch {
      toast.error('Failed to update campaign');
    }
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Delete this comment campaign?')) return;
    try {
      await api.delete(`/notifications/social/comment-campaigns/${id}`);
      await loadCampaigns();
    } catch {
      toast.error('Failed to delete campaign');
    }
  }

  const isConnected = credsStatus?.tokenConfigured;

  return (
    <div className="p-6 max-w-full space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Camera className="text-pink-600" size={22} />
          <h1 className="text-xl font-semibold text-gray-900">Facebook &amp; Instagram</h1>
          <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-gray-50 text-gray-500 border-gray-200">
            Messenger Platform
          </span>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium
            ${isConnected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
            {isConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
            {isConnected ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5 ml-8">
          DMs, comment-to-DM campaigns, and recommendation requests across your Facebook Page and Instagram Business account
        </p>
      </div>

      {/* Tab nav */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {([
          { key: 'inbox' as const,     label: 'Inbox',            icon: <MessagesSquare size={14} /> },
          ...(isSuperAdmin ? [
            { key: 'campaigns' as const, label: 'Comment Campaigns', icon: <CommentIcon size={14} /> },
            { key: 'settings' as const,  label: 'Settings',          icon: <SettingsIcon size={14} /> },
          ] : []),
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 border-b-2 -mb-px transition-colors
              ${tab === t.key ? 'border-pink-600 text-pink-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Inbox */}
      {tab === 'inbox' && <SocialChat />}

      {/* Comment Campaigns */}
      {isSuperAdmin && tab === 'campaigns' && campaignsLoaded && (
        <div className="max-w-3xl">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                Comment-to-DM Campaigns
                <FieldHelp title="Comment-to-DM"
                  description="When someone comments a matching keyword on your Page or Instagram post, we privately message them your reply — bypassing the normal 24h messaging window for up to 7 days. Leave Post/Media ID blank to match any post on that channel." />
              </p>
              <button
                onClick={() => { setCampaignForm({ ...BLANK_CAMPAIGN_FORM }); setShowCampaignForm(v => !v); }}
                className="btn-outline flex items-center gap-1.5 text-xs px-2.5 py-1.5">
                <Plus size={12} /> Add Campaign
              </button>
            </div>

            {showCampaignForm && (
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select className="input text-sm" value={campaignForm.channel}
                    onChange={e => setCampaignForm(f => ({ ...f, channel: e.target.value as 'FACEBOOK' | 'INSTAGRAM' }))}>
                    <option value="FACEBOOK">Facebook</option>
                    <option value="INSTAGRAM">Instagram</option>
                  </select>
                  <input className="input text-sm" placeholder="Post/Media ID (optional — blank = any post)"
                    value={campaignForm.postId} onChange={e => setCampaignForm(f => ({ ...f, postId: e.target.value }))} />
                </div>
                <input className="input text-sm w-full" placeholder="Trigger keyword (e.g. PRICE)"
                  value={campaignForm.triggerKeyword} onChange={e => setCampaignForm(f => ({ ...f, triggerKeyword: e.target.value }))} />
                <textarea className="input text-sm w-full resize-none" rows={3} placeholder="Private reply message"
                  value={campaignForm.replyMessage} onChange={e => setCampaignForm(f => ({ ...f, replyMessage: e.target.value }))} />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowCampaignForm(false)} className="btn-outline text-xs px-3 py-1.5">Cancel</button>
                  <button onClick={saveCampaign} disabled={savingCampaign} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                    {savingCampaign ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            <div className="px-5 py-4">
              {campaigns.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-5 border border-dashed border-gray-200 rounded-xl">
                  No comment campaigns yet — add one above.
                </p>
              ) : (
                <div className="space-y-2">
                  {campaigns.map(c => (
                    <div key={c.id} className={`flex items-start justify-between gap-3 border rounded-xl p-3 ${c.isActive ? 'border-gray-100' : 'border-gray-100 opacity-50'}`}>
                      <div className="min-w-0 flex items-start gap-2.5">
                        {c.channel === 'FACEBOOK' ? <Globe size={14} className="text-blue-600 mt-0.5 shrink-0" /> : <Camera size={14} className="text-pink-600 mt-0.5 shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                            "{c.triggerKeyword}"
                            {c.postId && <span className="text-[10px] font-normal text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5 font-mono">{c.postId}</span>}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{c.replyMessage}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => toggleCampaignActive(c)}
                          className={`text-[10px] font-semibold px-2 py-1 rounded-full ${c.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                          {c.isActive ? 'Active' : 'Paused'}
                        </button>
                        <button onClick={() => deleteCampaign(c.id)} className="text-gray-300 hover:text-red-500 p-1">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings */}
      {isSuperAdmin && tab === 'settings' && pageAccountsLoaded && (
        <div className="max-w-3xl space-y-8">
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Connection</h2>
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isConnected ? 'bg-green-50' : 'bg-red-50'}`}>
                    {isConnected ? <Wifi size={17} className="text-green-600" /> : <WifiOff size={17} className="text-red-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Facebook Page &amp; Instagram</p>
                    <p className={`text-xs ${isConnected ? 'text-green-600' : 'text-red-500'}`}>
                      {isConnected ? 'Connected and ready to send' : 'Not connected — activate a saved Page below'}
                    </p>
                  </div>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${isConnected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                  {isConnected ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>

              <div className="px-5 py-4 bg-amber-50/50 border-b border-amber-100">
                <p className="text-xs text-amber-800 leading-relaxed">
                  <b>Before this can go live:</b> a Meta Developer App needs to exist with Messenger/Instagram messaging
                  permissions requested and approved (Meta's App Review — this can take days to weeks and can't be
                  done from here). The webhook URL to register there is <code className="font-mono bg-white/60 px-1 rounded">/api/meta/webhook</code>,
                  verified using the <code className="font-mono bg-white/60 px-1 rounded">FB_WEBHOOK_VERIFY_TOKEN</code> / <code className="font-mono bg-white/60 px-1 rounded">FB_APP_SECRET</code> environment
                  variables — those are app-level secrets, set once in the server's .env, not per-Page here.
                </p>
              </div>

              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    Saved Pages
                    <FieldHelp title="Saved Pages" description="Save each Page's access token once, then switch which one is active with one click. One Page's token covers both its Facebook Messenger and its linked Instagram Business account." />
                  </p>
                  <button
                    onClick={() => { setEditingPageId(null); setPageForm({ ...BLANK_PAGE_FORM }); setShowPageForm(true); }}
                    className="btn-outline flex items-center gap-1.5 text-xs px-2.5 py-1.5">
                    <Plus size={12} /> Add Page
                  </button>
                </div>

                {showPageForm && (
                  <div className="mb-3 p-3 rounded-xl border border-gray-200 bg-gray-50/60 space-y-2">
                    <input className="input text-sm w-full" placeholder="Label (e.g. Srivani Stores FB Page)"
                      value={pageForm.label} onChange={e => setPageForm(f => ({ ...f, label: e.target.value }))} />
                    <input className="input text-sm w-full" placeholder="Page Access Token (leave blank to keep existing)"
                      type="password" value={pageForm.pageAccessToken} onChange={e => setPageForm(f => ({ ...f, pageAccessToken: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-2">
                      <input className="input text-sm" placeholder="Page ID"
                        value={pageForm.pageId} onChange={e => setPageForm(f => ({ ...f, pageId: e.target.value }))} />
                      <input className="input text-sm" placeholder="IG Business Account ID (optional)"
                        value={pageForm.igBusinessAccountId} onChange={e => setPageForm(f => ({ ...f, igBusinessAccountId: e.target.value }))} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setShowPageForm(false); setEditingPageId(null); }} className="btn-outline text-xs px-3 py-1.5">Cancel</button>
                      <button onClick={savePageAccount} disabled={savingPage} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                        {savingPage ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}

                {pageAccounts.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-5 border border-dashed border-gray-200 rounded-xl">No saved Pages yet — add one to get started.</p>
                ) : (
                  <div className="space-y-2">
                    {pageAccounts.map(p => (
                      <div key={p.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border flex-wrap ${p.isActive ? 'border-green-300 bg-green-50/60' : 'border-gray-200'}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                            {p.label}
                            {p.isActive && <span className="text-[10px] font-bold bg-green-500 text-white rounded-full px-1.5 py-0.5">ACTIVE</span>}
                          </p>
                          <p className="text-xs text-gray-400 font-mono truncate">{p.pageId}{p.igBusinessAccountId ? ` · IG ${p.igBusinessAccountId}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!p.isActive && (
                            <button onClick={() => activatePageAccount(p.id)} disabled={activatingId === p.id}
                              className="btn-primary text-xs px-2.5 py-1.5 disabled:opacity-50">
                              {activatingId === p.id ? 'Activating…' : 'Activate'}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingPageId(p.id);
                              setPageForm({ label: p.label, pageAccessToken: '', pageId: p.pageId, igBusinessAccountId: p.igBusinessAccountId ?? '' });
                              setShowPageForm(true);
                            }}
                            className="text-gray-400 hover:text-gray-700 p-1.5" title="Edit">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deletePageAccount(p.id, p.label)} className="text-gray-300 hover:text-red-500 p-1.5" title="Remove">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
