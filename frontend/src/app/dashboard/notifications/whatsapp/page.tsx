'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MessageSquare, Plus, Trash2, RefreshCw, CheckCircle2, Clock, XCircle,
  Send, KeyRound, PlayCircle, X, Wifi, WifiOff, AlertCircle,
  CheckCheck, ArrowUpRight, ArrowDownLeft, MousePointerClick,
  MessagesSquare, FileText, Settings as SettingsIcon, Bot, Cake, Phone, MapPin, Megaphone, Building2, Pencil,
  Contact as ContactIcon, Award,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import WhatsAppChat from './WhatsAppChat';
import ContactsTab from './ContactsTab';
import HistoryBlastTab from './HistoryBlastTab';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WaTemplate {
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED';
  category: string;
  language: string;
  rejected_reason?: string;
  components: Array<{
    type: string; text?: string; format?: string;
    buttons?: Array<{ type: string; text?: string; url?: string }>;
  }>;
}

const CATEGORIES = ['UTILITY', 'MARKETING', 'AUTHENTICATION'] as const;
const LANGUAGES  = [
  { code: 'en',    label: 'English' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'hi',    label: 'Hindi' },
  { code: 'te',    label: 'Telugu' },
];

const TEMPLATE_DESC: Record<string, string> = {
  test_order:        '📦 Store alert — sent to you when a new order arrives',
  svn_order_placed:  '🛍️ Customer confirmation — sent when COD order is placed',
  svn_payment_done:  '✅ Payment receipt — sent to customer after online payment',
  svn_order_update:  '🔔 Status update — sent to customer on order progress',
  svn_history_link:  '📜 History link — sent from customer page to share purchase history',
  hello_world:       '👋 Meta built-in test template',
  post_delivery_feedback:  '⭐ Feedback request — sent to customer after order is delivered',
  google_review_request:   '🌟 Review nudge — sent when a customer taps the positive feedback button',
  svn_credit_reminder:     '💰 Credit reminder — sent to customers with outstanding dues',
  svn_reorder_reminder:    '🔄 Reorder nudge — sent when customer hasn\'t ordered in a while',
  svn_welcome_customer:    '🌿 Welcome — sent to new customers on their first order',
  svn_back_in_stock:       '📢 Back in stock — sent when a product is restocked',
  svn_campaign:            '📣 Campaign — bulk promotional message',
};

interface RequiredTemplate {
  name: string; body: string; footer: string; headerText?: string;
  buttonMode?: 'quick_reply' | 'cta';
  quickReplies?: string[];
  ctaWebText?: string; ctaWebUrl?: string;
}

interface TemplatePreset extends RequiredTemplate {
  category: 'UTILITY' | 'MARKETING';
  description: string;
  emoji: string;
}

// A broader, always-browsable catalog of starting points beyond the required
// checklist below — pick one anytime, not just during initial setup. Meta
// doesn't expose its own template gallery via API, so this is a hand-written
// substitute living in our own dashboard.
const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    name: 'svn_out_for_delivery', category: 'UTILITY', emoji: '🚚',
    description: "Sent when a customer's order leaves for delivery",
    body: 'Hi {{1}}, good news — your order *{{2}}* is out for delivery and should arrive today. Please keep your phone handy in case our delivery partner needs to reach you.',
    footer: '',
  },
  {
    name: 'svn_cart_reminder', category: 'UTILITY', emoji: '🛒',
    description: 'Nudges a customer who left items in their online cart',
    body: 'Hi {{1}}, you left {{2}} in your cart! Complete your order before it sells out.',
    footer: '',
    buttonMode: 'cta', ctaWebText: 'Complete Order', ctaWebUrl: '',
  },
  {
    name: 'svn_loyalty_points_earned', category: 'UTILITY', emoji: '⭐',
    description: 'Lets a customer know they earned loyalty points on a purchase',
    body: 'Hi {{1}}, you just earned *{{2}} loyalty points* on your last purchase! Your total balance is now {{3}} points.',
    footer: 'Redeem points on your next visit',
  },
  {
    name: 'svn_sale_announcement', category: 'MARKETING', emoji: '🎉',
    description: 'Announces a seasonal or festival sale',
    body: 'Hi {{1}}, {{2}} is here! Enjoy special prices this week only. Visit us or shop online.',
    footer: '',
    buttonMode: 'cta', ctaWebText: 'Shop Now', ctaWebUrl: '',
  },
  {
    name: 'svn_new_arrival', category: 'MARKETING', emoji: '✨',
    description: 'Alerts customers to new products in stock',
    body: "Hi {{1}}, new arrivals just landed — including {{2}}! Check them out before they're gone.",
    footer: '',
    buttonMode: 'cta', ctaWebText: 'Browse New Arrivals', ctaWebUrl: '',
  },
  {
    name: 'svn_thank_you_loyal_customer', category: 'UTILITY', emoji: '🙏',
    description: 'A simple appreciation message for a repeat customer',
    body: 'Hi {{1}}, thank you for being a valued customer! We appreciate your continued support and look forward to serving you again.',
    footer: '',
  },
  {
    name: 'svn_refund_processed', category: 'UTILITY', emoji: '💳',
    description: 'Confirms a refund has been processed for an order',
    body: 'Hi {{1}}, your refund of ₹{{2}} for order *{{3}}* has been processed and should reflect in your account within 3-5 business days.',
    footer: '',
  },
  {
    name: 'svn_store_closure_notice', category: 'UTILITY', emoji: '🔔',
    description: 'Notifies customers of a holiday or closure',
    body: "Hi {{1}}, please note we'll be closed on {{2}}. We'll be back to serve you on {{3}}. Thank you for your understanding.",
    footer: '',
  },
];

const REQUIRED_TEMPLATES: RequiredTemplate[] = [
  { name: 'test_order',       body: 'Hello! New order {{1}} from {{2}} ({{3}}). Items: {{4}} | Total: ₹{{5}} | {{6}} | {{7}}',                                                                   footer: '- Srivani Stores' },
  { name: 'svn_order_placed', body: 'Hello {{1}}, your order *{{2}}* has been placed at Srivani Stores! Total: ₹{{3}} | {{4}}. Thank you for shopping with us!',                               footer: '- Srivani Stores' },
  { name: 'svn_payment_done', body: 'Hello {{1}}, payment of ₹{{2}} received! Order *{{3}}* is confirmed. We will start preparing it now. - Srivani Stores',                                  footer: '' },
  { name: 'svn_order_update', body: 'Hello {{1}}, your order *{{2}}* update: {{3}} - Team Srivani Stores',                                                                                      footer: '' },
  {
    name: 'post_delivery_feedback',
    body: 'Hi {{1}}, your order *{{2}}* was delivered! How was your experience?',
    footer: 'Tap a button below to let us know', headerText: '',
    buttonMode: 'quick_reply', quickReplies: ['👍 Great!', '👎 Not great', ''],
  },
  {
    name: 'google_review_request',
    body: 'Hi {{1}}, glad you had a great experience! Would you mind sharing it on Google? It really helps us.',
    footer: '', headerText: '',
    buttonMode: 'cta', ctaWebText: 'Rate us on Google', ctaWebUrl: '',
  },
];

const BLANK_FORM  = {
  name: '', category: 'UTILITY' as 'UTILITY' | 'MARKETING' | 'AUTHENTICATION', language: 'en', headerText: '', bodyText: '', footerText: '',
  buttonMode: 'none' as 'none' | 'quick_reply' | 'cta',
  quickReplies: ['', '', ''],
  ctaCallText: '', ctaCallPhone: '', ctaWebText: '', ctaWebUrl: '',
};
const BLANK_CREDS = { token: '', phoneId: '', wabaId: '', storeNum: '' };

interface WaMessage {
  id:           string;
  direction:    'OUTBOUND' | 'INBOUND';
  phone:        string;
  messageType:  string;
  templateName: string | null;
  bodyPreview:  string | null;
  buttonId:     string | null;
  status:       'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  errorMessage: string | null;
  relatedType:  string | null;
  relatedId:    string | null;
  createdAt:    string;
}

const MSG_STATUS_CONFIG = {
  QUEUED:    { label: 'Queued',    color: 'bg-gray-100 text-gray-500 border-gray-200',      icon: <Clock size={11} /> },
  SENT:      { label: 'Sent',      color: 'bg-blue-50 text-blue-700 border-blue-200',       icon: <Send size={11} /> },
  DELIVERED: { label: 'Delivered', color: 'bg-teal-50 text-teal-700 border-teal-200',       icon: <CheckCircle2 size={11} /> },
  READ:      { label: 'Read',      color: 'bg-green-50 text-green-700 border-green-200',    icon: <CheckCheck size={11} /> },
  FAILED:    { label: 'Failed',    color: 'bg-red-50 text-red-600 border-red-200',          icon: <XCircle size={11} /> },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface BirthdayCustomer { id: string; name: string; phone: string | null; dateOfBirth: string }
interface Segment { id: string; label: string; count: number }
interface PhoneNumberPreset {
  id: string; label: string; phoneNumberId: string; businessAccountId: string;
  storeNotifyNumber: string | null; isActive: boolean; createdAt: string;
}
const BLANK_NUMBER_FORM = { label: '', accessToken: '', phoneNumberId: '', businessAccountId: '', storeNotifyNumber: '' };

export default function WhatsAppTemplatesPage() {
  // Templates/Campaigns/Settings all back onto SUPER_ADMIN-only routes
  // (credentials, phone registration, template management, campaign sends) —
  // BRANCH_MANAGER can use the Chat inbox but would just hit 403s on these,
  // so the tabs themselves are hidden rather than shown-then-broken.
  const isSuperAdmin = getUser<{ role: string }>()?.role === 'SUPER_ADMIN';
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'chat' | 'contacts' | 'history-blast' | 'templates' | 'campaigns' | 'settings'>('chat');

  // Landing back here after the Google OAuth consent screen — oauth/callback
  // redirects to this page with one of these two params set.
  useEffect(() => {
    if (searchParams?.get('googleContactsConnected')) {
      toast.success('Google Contacts connected');
      setTab('settings');
      router.replace('/dashboard/notifications/whatsapp');
    } else if (searchParams?.get('googleContactsError')) {
      toast.error('Failed to connect Google Contacts — try again');
      setTab('settings');
      router.replace('/dashboard/notifications/whatsapp');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [cannedReplies, setCannedReplies] = useState<{ id: string; title: string; body: string; category: string | null }[]>([]);
  const [cannedRepliesLoaded, setCannedRepliesLoaded] = useState(false);
  const [showCannedForm, setShowCannedForm] = useState(false);
  const [cannedForm, setCannedForm] = useState({ title: '', body: '', category: '' });
  const [savingCanned, setSavingCanned] = useState(false);
  const [birthdays, setBirthdays] = useState<BirthdayCustomer[]>([]);
  const [birthdaysLoading, setBirthdaysLoading] = useState(false);
  const [birthdaysLoaded, setBirthdaysLoaded] = useState(false);
  const [birthdayTemplatePick, setBirthdayTemplatePick] = useState<Record<string, string>>({});
  const [segments, setSegments]           = useState<Segment[]>([]);
  const [segmentsLoaded, setSegmentsLoaded] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState('');
  const [broadcastTemplateName, setBroadcastTemplateName] = useState('');
  const [broadcastParams, setBroadcastParams] = useState<string[]>([]);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [businessProfile, setBusinessProfile] = useState({ about: '', address: '', description: '', email: '', vertical: '' });
  const [businessProfileLoaded, setBusinessProfileLoaded] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [templates, setTemplates]     = useState<WaTemplate[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState({ ...BLANK_FORM });
  const [submitting, setSubmitting]   = useState(false);
  const [testPhone, setTestPhone]     = useState('');
  const [testing, setTesting]         = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [creds, setCreds]             = useState({ ...BLANK_CREDS });
  const [credsStatus, setCredsStatus] = useState<{
    tokenConfigured: boolean; phoneId: string | null; storeNum: string | null; source: string;
  } | null>(null);
  const [savingCreds, setSavingCreds] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberPreset[]>([]);
  const [phoneNumbersLoaded, setPhoneNumbersLoaded] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [showNumberForm, setShowNumberForm] = useState(false);
  const [editingNumberId, setEditingNumberId] = useState<string | null>(null);
  const [numberForm, setNumberForm] = useState({ ...BLANK_NUMBER_FORM });
  const [savingNumber, setSavingNumber] = useState(false);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [storeHours, setStoreHours]             = useState('');
  const [autoReplyLoaded, setAutoReplyLoaded]   = useState(false);
  const [savingAutoReply, setSavingAutoReply]   = useState(false);
  const [registerPin, setRegisterPin]           = useState('');
  const [registering, setRegistering]           = useState(false);
  const [locationLat, setLocationLat]           = useState('');
  const [locationLng, setLocationLng]           = useState('');
  const [locationName, setLocationName]         = useState('');
  const [locationAddr, setLocationAddr]         = useState('');
  const [feedbackSettings, setFeedbackSettings] = useState({ googleReviewUrl: '' });
  const [feedbackSettingsLoaded, setFeedbackSettingsLoaded] = useState(false);
  const [savingFeedbackSettings, setSavingFeedbackSettings] = useState(false);
  const [googleCreds, setGoogleCreds] = useState<{ configured: boolean; connected: boolean; connectedAccountEmail: string | null } | null>(null);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [sendModal, setSendModal]     = useState<({
    template: WaTemplate; params: string[]; urlButtonParam: string; sending: boolean;
  } & ({ mode: 'single'; phone: string } | { mode: 'bulk'; ids: string[] })) | null>(null);

  // Message log
  const [waMessages, setWaMessages]     = useState<WaMessage[]>([]);
  const [waTotal, setWaTotal]           = useState(0);
  const [waLoading, setWaLoading]       = useState(true);
  const [waPage, setWaPage]             = useState(1);
  const [waExpanded, setWaExpanded]     = useState<string | null>(null);
  const [waDirFilter, setWaDirFilter]   = useState<'' | 'OUTBOUND' | 'INBOUND'>('');
  const [waStatusFilter, setWaStatusFilter] = useState<'' | WaMessage['status']>('');
  const WA_LIMIT = 20;

  const loadMessages = useCallback(async () => {
    setWaLoading(true);
    try {
      const { data } = await api.get('/notifications/whatsapp/messages', {
        params: {
          page: waPage,
          limit: WA_LIMIT,
          ...(waDirFilter ? { direction: waDirFilter } : {}),
          ...(waStatusFilter ? { status: waStatusFilter } : {}),
        },
      });
      setWaMessages(data?.items ?? []);
      setWaTotal(data?.total ?? 0);
    } catch {
      toast.error('Failed to load message log');
    } finally {
      setWaLoading(false);
    }
  }, [waPage, waDirFilter, waStatusFilter]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications/whatsapp/templates');
      if (data?.error) {
        const msg = data.error?.message ?? (typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
        toast.error(`Meta API: ${msg}`);
        setTemplates([]);
      } else {
        setTemplates((data?.data as WaTemplate[]) ?? []);
      }
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  // load() (templates) and loadCreds() (connected/not-connected status only,
  // no secrets) are needed by everyone — BRANCH_MANAGER uses templates for
  // New Chat, and the header's Connected/Not Connected badge is shown
  // regardless of tab, so it needs real data rather than defaulting to a
  // permanently-misleading "Not connected". The other three back onto
  // SUPER_ADMIN-only config routes (autoreply, business-profile,
  // phone-numbers) — fetching them for BRANCH_MANAGER just wastes a request
  // that 403s, and loadPhoneNumbers() specifically surfaces that 403 as a
  // visible error toast on every page load, so those three must not fire at
  // all for non-admins.
  useEffect(() => {
    load();
    loadCreds();
    if (isSuperAdmin) { loadAutoReply(); loadBusinessProfile(); loadPhoneNumbers(); loadFeedbackSettings(); loadGoogleCreds(); }
  }, [load, isSuperAdmin]);

  async function loadGoogleCreds() {
    try {
      const { data } = await api.get('/google-contacts/credentials');
      setGoogleCreds(data);
    } catch { /* ignore */ }
  }

  async function connectGoogle() {
    setConnectingGoogle(true);
    try {
      const { data } = await api.get('/google-contacts/oauth/start');
      window.location.href = data.url;
    } catch {
      toast.error('Failed to start Google connection');
      setConnectingGoogle(false);
    }
  }

  async function disconnectGoogle() {
    if (!confirm('Disconnect Google Contacts? Existing sync links stay on affected customers but nothing will sync until you reconnect.')) return;
    try {
      await api.post('/google-contacts/disconnect');
      toast.success('Google Contacts disconnected');
      loadGoogleCreds();
    } catch {
      toast.error('Failed to disconnect');
    }
  }

  async function syncGoogleNow() {
    setSyncingGoogle(true);
    try {
      const { data } = await api.post('/google-contacts/sync/now');
      toast.success(`Synced: ${data.pushed} pushed, ${data.pulled} pulled, ${data.conflicts} conflict(s), ${data.failed} failed`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Sync failed');
    } finally {
      setSyncingGoogle(false);
    }
  }

  async function loadCreds() {
    try {
      const { data } = await api.get('/notifications/whatsapp/credentials');
      setCredsStatus(data);
    } catch { /* ignore */ }
  }

  const loadBirthdays = useCallback(async () => {
    setBirthdaysLoading(true);
    try {
      const { data } = await api.get('/notifications/whatsapp/campaigns/birthdays-today');
      setBirthdays(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load birthdays');
    } finally {
      setBirthdaysLoading(false);
      setBirthdaysLoaded(true);
    }
  }, []);

  const loadSegments = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/whatsapp/campaigns/segments');
      setSegments(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load segments');
    } finally {
      setSegmentsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (tab === 'campaigns' && !segmentsLoaded) loadSegments();
  }, [tab, segmentsLoaded, loadSegments]);

  const loadCannedReplies = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/whatsapp/canned-replies');
      setCannedReplies(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load quick replies');
    } finally {
      setCannedRepliesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (tab === 'settings' && !cannedRepliesLoaded) loadCannedReplies();
  }, [tab, cannedRepliesLoaded, loadCannedReplies]);

  async function saveCannedReply() {
    if (!cannedForm.title.trim() || !cannedForm.body.trim()) return;
    setSavingCanned(true);
    try {
      await api.post('/notifications/whatsapp/canned-replies', {
        title: cannedForm.title.trim(),
        body: cannedForm.body.trim(),
        category: cannedForm.category.trim() || undefined,
      });
      setCannedForm({ title: '', body: '', category: '' });
      setShowCannedForm(false);
      await loadCannedReplies();
      toast.success('Quick reply saved');
    } catch {
      toast.error('Failed to save quick reply');
    } finally {
      setSavingCanned(false);
    }
  }

  async function deleteCannedReply(id: string) {
    if (!confirm('Delete this quick reply?')) return;
    try {
      await api.delete(`/notifications/whatsapp/canned-replies/${id}`);
      await loadCannedReplies();
    } catch {
      toast.error('Failed to delete quick reply');
    }
  }

  async function sendBroadcast() {
    const segment = segments.find(s => s.id === selectedSegment);
    if (!segment || !broadcastTemplateName) return;
    if (!confirm(`Send "${broadcastTemplateName}" to ${segment.count} customer(s) in "${segment.label}"? This cannot be undone.`)) return;
    setSendingBroadcast(true);
    try {
      const t = templates.find(x => x.name === broadcastTemplateName);
      const { data } = await api.post('/notifications/whatsapp/campaigns/send', {
        segmentId: selectedSegment,
        template: broadcastTemplateName,
        language: t?.language ?? 'en',
        params: broadcastParams,
      });
      toast.success(`Broadcast sent: ${data.sent} delivered, ${data.failed} failed (of ${data.total})`);
      setSelectedSegment('');
      setBroadcastTemplateName('');
      setBroadcastParams([]);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Broadcast failed');
    } finally {
      setSendingBroadcast(false);
    }
  }

  async function loadBusinessProfile() {
    try {
      const { data } = await api.get('/notifications/whatsapp/business-profile');
      if (!data?.error) {
        setBusinessProfile({
          about: data?.about ?? '', address: data?.address ?? '', description: data?.description ?? '',
          email: data?.email ?? '', vertical: data?.vertical ?? '',
        });
      }
    } catch { /* ignore */ } finally {
      setBusinessProfileLoaded(true);
    }
  }

  async function saveBusinessProfile() {
    setSavingProfile(true);
    try {
      const { data } = await api.patch('/notifications/whatsapp/business-profile', businessProfile);
      if (data?.ok) toast.success('Business profile updated on WhatsApp');
      else toast.error(JSON.stringify(data?.error?.error?.message ?? data?.error ?? 'Update failed'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Update failed');
    } finally {
      setSavingProfile(false);
    }
  }

  useEffect(() => {
    if (tab === 'campaigns' && !birthdaysLoaded) loadBirthdays();
  }, [tab, birthdaysLoaded, loadBirthdays]);

  async function loadAutoReply() {
    try {
      const { data } = await api.get('/notifications/whatsapp/autoreply');
      setAutoReplyEnabled(!!data?.enabled);
      setStoreHours(data?.storeHours ?? '');
      setLocationLat(data?.locationLat ?? '');
      setLocationLng(data?.locationLng ?? '');
      setLocationName(data?.locationName ?? '');
      setLocationAddr(data?.locationAddr ?? '');
    } catch { /* ignore */ } finally {
      setAutoReplyLoaded(true);
    }
  }

  async function loadFeedbackSettings() {
    try {
      const { data } = await api.get('/notifications/whatsapp/feedback-settings');
      setFeedbackSettings({ googleReviewUrl: data?.googleReviewUrl ?? '' });
    } catch { /* ignore */ } finally {
      setFeedbackSettingsLoaded(true);
    }
  }

  async function saveFeedbackSettings(next: { googleReviewUrl?: string }) {
    setSavingFeedbackSettings(true);
    try {
      const { data } = await api.patch('/notifications/whatsapp/feedback-settings', next);
      setFeedbackSettings({ googleReviewUrl: data?.googleReviewUrl ?? '' });
      toast.success('Feedback settings saved');
    } catch {
      toast.error('Failed to save feedback settings');
    } finally {
      setSavingFeedbackSettings(false);
    }
  }

  async function registerNumber() {
    if (!/^\d{6}$/.test(registerPin)) return toast.error('PIN must be exactly 6 digits');
    setRegistering(true);
    try {
      const { data } = await api.post('/notifications/whatsapp/register-number', { pin: registerPin });
      if (data?.ok) {
        toast.success('Number registered! It should now be active on the Cloud API.');
        setRegisterPin('');
      } else {
        toast.error(data?.reason ?? 'Registration failed');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Registration failed');
    } finally {
      setRegistering(false);
    }
  }

  async function saveAutoReply(next: {
    enabled?: boolean; storeHours?: string;
    locationLat?: string; locationLng?: string; locationName?: string; locationAddr?: string;
  }) {
    setSavingAutoReply(true);
    try {
      const { data } = await api.patch('/notifications/whatsapp/autoreply', next);
      setAutoReplyEnabled(!!data?.enabled);
      setStoreHours(data?.storeHours ?? '');
      setLocationLat(data?.locationLat ?? '');
      setLocationLng(data?.locationLng ?? '');
      setLocationName(data?.locationName ?? '');
      setLocationAddr(data?.locationAddr ?? '');
      toast.success('Auto-reply settings saved');
    } catch {
      toast.error('Failed to save auto-reply settings');
    } finally {
      setSavingAutoReply(false);
    }
  }

  async function saveCreds() {
    const payload = Object.fromEntries(Object.entries(creds).filter(([, v]) => v.trim() !== ''));
    if (Object.keys(payload).length === 0) return toast.error('Enter at least one field to update');
    setSavingCreds(true);
    try {
      const { data } = await api.patch('/notifications/whatsapp/credentials', payload);
      setCredsStatus(data);
      setCreds({ ...BLANK_CREDS });
      setShowCredsModal(false);
      toast.success('Credentials saved — active immediately');
      load();
    } catch {
      toast.error('Failed to save credentials');
    } finally {
      setSavingCreds(false);
    }
  }

  async function loadPhoneNumbers() {
    try {
      const { data } = await api.get('/notifications/whatsapp/phone-numbers');
      setPhoneNumbers(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load phone numbers');
    } finally {
      setPhoneNumbersLoaded(true);
    }
  }

  async function saveNumber() {
    if (!numberForm.label.trim() || !numberForm.phoneNumberId.trim() || !numberForm.businessAccountId.trim()) {
      return toast.error('Label, Phone Number ID, and Business Account ID are required');
    }
    if (!editingNumberId && !numberForm.accessToken.trim()) {
      return toast.error('Access token is required for a new number');
    }
    setSavingNumber(true);
    try {
      const { data } = await api.post('/notifications/whatsapp/phone-numbers', {
        id: editingNumberId ?? undefined,
        label: numberForm.label.trim(),
        accessToken: numberForm.accessToken.trim() || undefined,
        phoneNumberId: numberForm.phoneNumberId.trim(),
        businessAccountId: numberForm.businessAccountId.trim(),
        storeNotifyNumber: numberForm.storeNotifyNumber.trim() || undefined,
      });
      setPhoneNumbers(data);
      setShowNumberForm(false);
      setNumberForm({ ...BLANK_NUMBER_FORM });
      setEditingNumberId(null);
      toast.success('Number saved');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to save number');
    } finally {
      setSavingNumber(false);
    }
  }

  async function activateNumber(id: string) {
    setActivatingId(id);
    try {
      const { data } = await api.post(`/notifications/whatsapp/phone-numbers/${id}/activate`);
      setPhoneNumbers(data);
      toast.success('Number activated');
      loadCreds();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to activate number');
    } finally {
      setActivatingId(null);
    }
  }

  async function deleteNumber(id: string, label: string) {
    if (!confirm(`Remove saved number "${label}"? This only removes it from this list — it doesn't affect the number on Meta.`)) return;
    try {
      const { data } = await api.delete(`/notifications/whatsapp/phone-numbers/${id}`);
      setPhoneNumbers(data);
      toast.success('Number removed');
    } catch {
      toast.error('Failed to remove number');
    }
  }

  async function submit() {
    if (!form.name.trim()) return toast.error('Template name is required');
    if (!form.bodyText.trim()) return toast.error('Body text is required');
    const nameClean = form.name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (nameClean !== form.name.trim()) {
      toast.error('Name must be lowercase letters, numbers and underscores only');
      return;
    }
    let buttons: Array<
      | { type: 'QUICK_REPLY'; text: string }
      | { type: 'PHONE_NUMBER'; text: string; phone_number: string }
      | { type: 'URL'; text: string; url: string }
    > | undefined;
    if (form.buttonMode === 'quick_reply') {
      const qr = form.quickReplies.map(q => q.trim()).filter(Boolean);
      if (qr.length > 0) buttons = qr.map(text => ({ type: 'QUICK_REPLY' as const, text }));
    } else if (form.buttonMode === 'cta') {
      const cta: typeof buttons = [];
      if (form.ctaCallText.trim() && form.ctaCallPhone.trim()) {
        cta!.push({ type: 'PHONE_NUMBER', text: form.ctaCallText.trim(), phone_number: form.ctaCallPhone.trim() });
      }
      if (form.ctaWebText.trim() && form.ctaWebUrl.trim()) {
        cta!.push({ type: 'URL', text: form.ctaWebText.trim(), url: form.ctaWebUrl.trim() });
      }
      if (cta!.length > 0) buttons = cta;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/notifications/whatsapp/templates', {
        name:       form.name.trim(),
        category:   form.category,
        language:   form.language,
        bodyText:   form.bodyText.trim(),
        headerText: form.headerText.trim() || undefined,
        footerText: form.footerText.trim() || undefined,
        buttons,
      });
      if (data?.id || data?.status === 'PENDING') {
        toast.success('Template submitted to Meta for approval!');
        setForm({ ...BLANK_FORM });
        setShowForm(false);
        await load();
      } else {
        toast.error(data?.error?.message ?? data?.error ?? 'Submission failed');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(name: string) {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/notifications/whatsapp/templates/${name}`);
      toast.success(`"${name}" deleted`);
      await load();
    } catch {
      toast.error('Delete failed');
    }
  }

  async function subscribeApp() {
    setSubscribing(true);
    try {
      const { data } = await api.post('/notifications/whatsapp/subscribe-app');
      if (data?.ok) toast.success('App subscribed to WABA! Webhooks will now receive messages and statuses.');
      else toast.error(data?.error ?? 'Subscription failed');
    } catch {
      toast.error('Subscription failed');
    } finally {
      setSubscribing(false);
    }
  }

  async function sendHelloWorld() {
    if (!testPhone.trim()) return toast.error('Enter a phone number');
    setTesting(true);
    try {
      const { data } = await api.post('/notifications/whatsapp/test', { phone: testPhone.trim() });
      if (data?.ok) toast.success(`hello_world sent to ${data.to}`);
      else toast.error(data?.reason ?? 'Failed');
    } catch {
      toast.error('Test failed');
    } finally {
      setTesting(false);
    }
  }

  const bodyPreview = (t: WaTemplate) =>
    t.components.find(c => c.type === 'BODY')?.text ?? '—';

  function varCount(t: WaTemplate): number {
    const matches = bodyPreview(t).match(/\{\{\d+\}\}/g) ?? [];
    const nums = matches.map(m => parseInt(m.replace(/\D/g, ''), 10));
    return nums.length ? Math.max(...nums) : 0;
  }

  // Some templates (e.g. svn_history_link) have a URL button with its own
  // dynamic {{1}} suffix — a separate variable slot from the body's, on a
  // different Meta API component entirely. Sending the body param alone
  // (what varCount/params covers) is not enough for these; Meta rejects the
  // whole send with "(#131008) Required parameter is missing" if this one
  // is left out. Detect it so the modal can ask for it too.
  function hasDynamicUrlButton(t: WaTemplate): boolean {
    const buttons = t.components.find(c => c.type === 'BUTTONS')?.buttons ?? [];
    return buttons.some(b => b.type === 'URL' && /\{\{\d+\}\}/.test(b.url ?? ''));
  }

  // For flows that auto-pick a template (New Chat, Contacts bulk send),
  // prefer one that "just works" out of the box — no dynamic URL button
  // needing a value only the dedicated per-feature flow (e.g. Send History)
  // actually knows. Falls back to the first approved template if every
  // approved one happens to need one.
  function pickDefaultTemplate(approved: WaTemplate[]): WaTemplate {
    return approved.find(t => !hasDynamicUrlButton(t)) ?? approved[0];
  }

  function openSendModal(t: WaTemplate) {
    setSendModal({ mode: 'single', template: t, phone: testPhone || '', params: Array(varCount(t)).fill(''), urlButtonParam: '', sending: false });
  }

  function openSendModalForPhone(t: WaTemplate, phone: string, prefillName?: string) {
    const params = Array(varCount(t)).fill('');
    // Best-effort default: most customer-facing templates address the
    // recipient by name in the first variable. Still fully editable — this
    // just saves re-typing a name the chat already knows, it's not assumed
    // correct for every template.
    if (prefillName && params.length > 0) params[0] = prefillName;
    setSendModal({ mode: 'single', template: t, phone, params, urlButtonParam: '', sending: false });
  }

  // Contacts tab bulk action: same shared modal, template picked automatically
  // (a "safe" one — see pickDefaultTemplate — matching startNewChat's own
  // default) since most selected address-book contacts have no open session.
  function openBulkSendModal(ids: string[]) {
    const approved = templates.filter(t => t.status === 'APPROVED');
    if (approved.length === 0) {
      toast.error('No approved templates yet — add one in Settings → Templates first');
      return;
    }
    const t = pickDefaultTemplate(approved);
    setSendModal({ mode: 'bulk', template: t, ids, params: Array(varCount(t)).fill(''), urlButtonParam: '', sending: false });
  }

  // New Chat (Chat tab): a number with no message history has no open 24h
  // session, so Meta only allows an approved template as the first message —
  // reuses the exact same send-template modal/endpoint the Campaigns tab
  // already uses, just opened with one phone instead of a whole segment.
  function startNewChat(phone: string, name?: string) {
    const approved = templates.filter(t => t.status === 'APPROVED');
    if (approved.length === 0) {
      toast.error('No approved templates yet — add one in Settings → Templates first');
      return;
    }
    openSendModalForPhone(pickDefaultTemplate(approved), phone, name);
  }

  // Contacts tab action: an existing thread just needs the Chat tab focused
  // on that phone (same ?phone= deep-link WhatsAppChat already reads on
  // mount for push-notification click-through); no thread yet reuses the
  // New Chat flow directly.
  function openContact(phone: string, hasThread: boolean, name?: string) {
    if (hasThread) {
      router.push(`/dashboard/notifications/whatsapp?phone=91${phone}`);
      setTab('chat');
    } else {
      startNewChat(phone, name);
    }
  }

  async function sendFromModal() {
    if (!sendModal) return;
    if (sendModal.mode === 'single' && !sendModal.phone.trim()) return toast.error('Enter a phone number');
    if (hasDynamicUrlButton(sendModal.template) && sendModal.mode === 'bulk') {
      return toast.error(`"${sendModal.template.name}" has a per-recipient link (e.g. a unique token) — bulk-send doesn't support that yet. Send it one contact at a time instead.`);
    }
    if (hasDynamicUrlButton(sendModal.template) && !sendModal.urlButtonParam.trim()) {
      return toast.error('This template\'s button needs a link value too — Meta will reject the send without it.');
    }
    setSendModal(m => m ? { ...m, sending: true } : null);
    try {
      if (sendModal.mode === 'bulk') {
        const { data } = await api.post('/notifications/whatsapp/campaigns/send-bulk', {
          ids:      sendModal.ids,
          template: sendModal.template.name,
          language: sendModal.template.language,
          params:   sendModal.params,
        });
        toast.success(`"${sendModal.template.name}" sent to ${data.sent}/${data.requested} selected contact(s)${data.eligible < data.requested ? ` (${data.requested - data.eligible} skipped — not opted in)` : ''}`);
        setSendModal(null);
        return;
      }
      const { data } = await api.post('/notifications/whatsapp/send-template', {
        phone:    sendModal.phone.trim(),
        template: sendModal.template.name,
        language: sendModal.template.language,
        params:   sendModal.params,
        urlButtonParam: sendModal.urlButtonParam.trim() || undefined,
      });
      if (data?.ok) {
        toast.success(`"${sendModal.template.name}" sent to ${data.to}`);
        setSendModal(null);
      } else {
        toast.error(data?.reason ?? 'Send failed');
        setSendModal(m => m ? { ...m, sending: false } : null);
      }
    } catch {
      toast.error('Send failed');
      setSendModal(m => m ? { ...m, sending: false } : null);
    }
  }

  const existingNames   = new Set(templates.map(t => t.name));
  const missingRequired = REQUIRED_TEMPLATES.filter(r => !existingNames.has(r.name));
  const isConnected     = credsStatus?.tokenConfigured;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
    <div className={`p-6 space-y-5 ${tab === 'chat' || tab === 'contacts' ? 'max-w-full' : 'max-w-4xl mx-auto'}`}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="text-green-600" size={22} />
            <h1 className="text-xl font-semibold text-gray-900">PaVa Connect</h1>
            <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-gray-50 text-gray-500 border-gray-200">
              WhatsApp
            </span>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium
              ${isConnected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
              {isConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
              {isConnected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 ml-8">Chat with customers, manage templates and connection settings</p>
        </div>
        {tab === 'templates' && (
          <div className="flex gap-2">
            <button onClick={load} className="btn-outline flex items-center gap-1.5 text-sm">
              <RefreshCw size={13} /> Refresh
            </button>
            <button onClick={() => { setShowForm(v => !v); setForm({ ...BLANK_FORM }); }}
              className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus size={13} /> New Template
            </button>
          </div>
        )}
      </div>

      {/* ── Tab nav ── */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {([
          { key: 'chat' as const,      label: 'Chat',      icon: <MessagesSquare size={14} /> },
          { key: 'contacts' as const,  label: 'Contacts',  icon: <ContactIcon size={14} /> },
          ...(isSuperAdmin ? [
            { key: 'history-blast' as const, label: 'History Blast', icon: <Award size={14} /> },
            { key: 'templates' as const,     label: 'Templates',     icon: <FileText size={14} /> },
            { key: 'campaigns' as const,     label: 'Campaigns',     icon: <Cake size={14} /> },
            { key: 'settings' as const,      label: 'Settings',      icon: <SettingsIcon size={14} /> },
          ] : []),
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 border-b-2 -mb-px transition-colors
              ${tab === t.key ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Chat tab ── */}
      {tab === 'chat' && <WhatsAppChat onStartNewChat={startNewChat} />}

      {/* ── Contacts tab ── */}
      {tab === 'contacts' && <ContactsTab onOpenContact={openContact} onBulkSend={openBulkSendModal} />}

      {/* ── History Blast tab ── */}
      {isSuperAdmin && tab === 'history-blast' && <HistoryBlastTab />}

      {/* ── Settings tab ── */}
      {isSuperAdmin && tab === 'settings' && phoneNumbersLoaded && (
      <div className="space-y-8 max-w-3xl">

        {/* SECTION: Connection */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Connection</h2>
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isConnected ? 'bg-green-50' : 'bg-red-50'}`}>
                  {isConnected ? <Wifi size={17} className="text-green-600" /> : <WifiOff size={17} className="text-red-500" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">WhatsApp Business</p>
                  <p className={`text-xs ${isConnected ? 'text-green-600' : 'text-red-500'}`}>
                    {isConnected ? 'Connected and ready to send' : 'Not connected — activate a saved number below'}
                  </p>
                </div>
              </div>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${isConnected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                {isConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  Saved Numbers
                  <span
                    title="Save each WhatsApp number once (label, token, IDs), then switch which one is active with one click — no need to retype credentials every time you change numbers."
                    className="cursor-help text-gray-400 normal-case font-normal">ⓘ</span>
                </p>
                <button
                  onClick={() => { setEditingNumberId(null); setNumberForm({ ...BLANK_NUMBER_FORM }); setShowNumberForm(true); }}
                  className="btn-outline flex items-center gap-1.5 text-xs px-2.5 py-1.5">
                  <Plus size={12} /> Add Number
                </button>
              </div>
              {phoneNumbers.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-5 border border-dashed border-gray-200 rounded-xl">No saved numbers yet — add one to get started.</p>
              ) : (
                <div className="space-y-2">
                  {phoneNumbers.map(n => (
                    <div key={n.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border flex-wrap ${n.isActive ? 'border-green-300 bg-green-50/60' : 'border-gray-200'}`}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                          {n.label}
                          {n.isActive && <span className="text-[10px] font-bold bg-green-500 text-white rounded-full px-1.5 py-0.5">ACTIVE</span>}
                        </p>
                        <p className="text-xs text-gray-400 font-mono truncate">{n.phoneNumberId}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!n.isActive && (
                          <button onClick={() => activateNumber(n.id)} disabled={activatingId === n.id}
                            className="btn-primary text-xs px-2.5 py-1.5 disabled:opacity-50">
                            {activatingId === n.id ? 'Activating…' : 'Activate'}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingNumberId(n.id);
                            setNumberForm({ label: n.label, accessToken: '', phoneNumberId: n.phoneNumberId, businessAccountId: n.businessAccountId, storeNotifyNumber: n.storeNotifyNumber ?? '' });
                            setShowNumberForm(true);
                          }}
                          className="text-gray-400 hover:text-gray-700 p-1.5" title="Edit">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteNumber(n.id, n.label)} className="text-gray-300 hover:text-red-500 p-1.5" title="Remove">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 px-5 py-3.5 bg-gray-50/70 border-t border-gray-100">
              <span className="text-xs text-gray-500 whitespace-nowrap font-medium">Quick test</span>
              <input
                className="input flex-1 text-sm h-8 py-1.5"
                placeholder="Phone number e.g. 93828 28484"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
              />
              <button onClick={sendHelloWorld} disabled={testing}
                className="flex items-center gap-1.5 text-xs bg-white border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 whitespace-nowrap transition-colors">
                <Send size={12} /> {testing ? 'Sending…' : 'Send hello_world'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-blue-50/60 border-t border-blue-100">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-800">Subscribe App to WABA</p>
                <p className="text-xs text-blue-600 mt-0.5">Required once — lets Meta deliver webhook messages and statuses to this ERP</p>
              </div>
              <button onClick={subscribeApp} disabled={subscribing}
                className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors disabled:opacity-50 shrink-0">
                <Wifi size={12} /> {subscribing ? 'Subscribing…' : 'Subscribe Now'}
              </button>
            </div>
          </div>
        </div>

        {/* SECTION: Quick Replies */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Replies</h2>
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                Saved Replies
                <span
                  title="One-click prefab replies staff can insert while chatting — type / in the message box to search them, or use the lightning-bolt button next to the composer."
                  className="cursor-help text-gray-400 normal-case font-normal">ⓘ</span>
              </p>
              <button
                onClick={() => { setCannedForm({ title: '', body: '', category: '' }); setShowCannedForm(v => !v); }}
                className="btn-outline flex items-center gap-1.5 text-xs px-2.5 py-1.5">
                <Plus size={12} /> Add Quick Reply
              </button>
            </div>

            {showCannedForm && (
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input text-sm"
                    placeholder="Title (e.g. Refund policy)"
                    value={cannedForm.title}
                    onChange={e => setCannedForm(f => ({ ...f, title: e.target.value }))}
                  />
                  <input
                    className="input text-sm"
                    placeholder="Category (optional, e.g. Billing)"
                    value={cannedForm.category}
                    onChange={e => setCannedForm(f => ({ ...f, category: e.target.value }))}
                  />
                </div>
                <textarea
                  className="input text-sm w-full resize-none"
                  rows={3}
                  placeholder="Reply text"
                  value={cannedForm.body}
                  onChange={e => setCannedForm(f => ({ ...f, body: e.target.value }))}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowCannedForm(false)} className="btn-outline text-xs px-3 py-1.5">Cancel</button>
                  <button
                    onClick={saveCannedReply}
                    disabled={savingCanned || !cannedForm.title.trim() || !cannedForm.body.trim()}
                    className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                    {savingCanned ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            <div className="px-5 py-4">
              {!cannedRepliesLoaded ? (
                <p className="text-xs text-gray-400 text-center py-3">Loading…</p>
              ) : cannedReplies.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-5 border border-dashed border-gray-200 rounded-xl">No quick replies yet — add one above.</p>
              ) : (
                <div className="space-y-2">
                  {cannedReplies.map(r => (
                    <div key={r.id} className="flex items-start justify-between gap-3 border border-gray-100 rounded-xl p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                          {r.title}
                          {r.category && <span className="text-[10px] font-normal text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">{r.category}</span>}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{r.body}</p>
                      </div>
                      <button onClick={() => deleteCannedReply(r.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION: Automation */}
        {autoReplyLoaded && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Automation</h2>
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <Bot size={16} className="text-indigo-500" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    Auto-Reply
                    <span
                      title="Rule-based, no AI. Message START or SUBSCRIBE to opt a contact in (creates them as a Customer if new); STOP or UNSUBSCRIBE opts out — both are exact-match, so they never trigger by accident. On a first-ever message it also sends a welcome menu (Track Order / Store Hours / Talk to Staff). Keywords like 'order'/'status' trigger an order-status lookup; 'hours'/'timing' reply with your store hours below. Every automated message is tagged 'Auto' in the Chat tab so staff can tell it apart from a human reply."
                      className="cursor-help text-gray-400 font-normal">ⓘ</span>
                  </p>
                </div>
                <button
                  onClick={() => saveAutoReply({ enabled: !autoReplyEnabled })}
                  disabled={savingAutoReply}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${autoReplyEnabled ? 'bg-green-500' : 'bg-gray-300'} disabled:opacity-50`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoReplyEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div>
                <label className="label text-sm">Store Hours <span className="text-gray-400 font-normal text-xs">(shown when a customer asks about timings)</span></label>
                <input
                  className="input text-sm"
                  placeholder="Mon–Sat, 9 AM – 9 PM"
                  value={storeHours}
                  onChange={e => setStoreHours(e.target.value)}
                  onBlur={() => { if (storeHours.trim()) saveAutoReply({ storeHours: storeHours.trim() }); }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                  <MapPin size={16} className="text-rose-500" />
                </div>
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  Store Location
                  <span
                    title="Shown to customers who tap 'Store Location' in the auto-reply menu — sent as a native WhatsApp location pin if coordinates are set, otherwise falls back to the address text. Get coordinates by right-clicking your store on Google Maps."
                    className="cursor-help text-gray-400 font-normal">ⓘ</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="label text-xs">Latitude</label>
                  <input className="input text-sm" placeholder="e.g. 17.6255"
                    value={locationLat} onChange={e => setLocationLat(e.target.value)}
                    onBlur={() => saveAutoReply({ locationLat: locationLat.trim() })} />
                </div>
                <div>
                  <label className="label text-xs">Longitude</label>
                  <input className="input text-sm" placeholder="e.g. 78.0857"
                    value={locationLng} onChange={e => setLocationLng(e.target.value)}
                    onBlur={() => saveAutoReply({ locationLng: locationLng.trim() })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Location name</label>
                  <input className="input text-sm" placeholder="e.g. Srivani Stores"
                    value={locationName} onChange={e => setLocationName(e.target.value)}
                    onBlur={() => saveAutoReply({ locationName: locationName.trim() })} />
                </div>
                <div>
                  <label className="label text-xs">Address <span className="text-gray-400 font-normal">(fallback)</span></label>
                  <input className="input text-sm" placeholder="Used if no coordinates set"
                    value={locationAddr} onChange={e => setLocationAddr(e.target.value)}
                    onBlur={() => saveAutoReply({ locationAddr: locationAddr.trim() })} />
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* SECTION: Feedback & Reviews */}
        {feedbackSettingsLoaded && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Feedback &amp; Reviews</h2>
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <Award size={16} className="text-amber-500" />
              </div>
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                Google Review Link
                <span
                  title="Reference only — the actual link customers see is baked into the google_review_request template's button when you create it below. Stored here so it can pre-fill that form and be reused later."
                  className="cursor-help text-gray-400 font-normal">ⓘ</span>
              </p>
            </div>
            <label className="label text-xs">Your Google Business review link</label>
            <input
              className="input text-sm" placeholder="https://g.page/r/.../review"
              value={feedbackSettings.googleReviewUrl}
              onChange={e => setFeedbackSettings({ googleReviewUrl: e.target.value })}
              onBlur={() => saveFeedbackSettings({ googleReviewUrl: feedbackSettings.googleReviewUrl.trim() })}
              disabled={savingFeedbackSettings}
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Set up the <span className="font-mono">post_delivery_feedback</span> and <span className="font-mono">google_review_request</span> templates below (Setup Checklist) to start asking delivered customers for feedback and nudging happy ones toward a Google review.
            </p>
          </div>
        </div>
        )}

        {/* SECTION: Business Info */}
        {businessProfileLoaded && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Business Info</h2>
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Building2 size={16} className="text-gray-500" />
              </div>
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                Business Profile
                <span
                  title="Your public 'About this business' info that customers see on WhatsApp — pulled from and pushed to Meta directly, same as editing it in Meta Business Manager."
                  className="cursor-help text-gray-400 font-normal">ⓘ</span>
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label text-xs">About</label>
                <input className="input text-sm" placeholder="Short status line" maxLength={139}
                  value={businessProfile.about} onChange={e => setBusinessProfile(p => ({ ...p, about: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs">Email</label>
                <input className="input text-sm" placeholder="store@example.com"
                  value={businessProfile.email} onChange={e => setBusinessProfile(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div className="mb-3">
              <label className="label text-xs">Address</label>
              <input className="input text-sm" placeholder="Shop address"
                value={businessProfile.address} onChange={e => setBusinessProfile(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="mb-4">
              <label className="label text-xs">Description</label>
              <textarea rows={2} className="input text-sm" placeholder="What your business does"
                value={businessProfile.description} onChange={e => setBusinessProfile(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="flex justify-end">
              <button onClick={saveBusinessProfile} disabled={savingProfile} className="btn-primary text-sm px-4 disabled:opacity-50">
                {savingProfile ? 'Saving…' : 'Save to WhatsApp'}
              </button>
            </div>
          </div>
        </div>
        )}

        {/* SECTION: Advanced */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Advanced</h2>
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Phone size={16} className="text-gray-500" />
              </div>
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                Register This Number
                <span
                  title="A one-time Meta requirement to activate a phone number for Cloud API sending/receiving — the same thing the 'Register' button in Meta's own dashboard does. Only needed if the connected number shows as 'Pending' in Meta Business Manager. Choose any 6-digit PIN you'll remember; this is a two-step-verification PIN for the number, not your Meta login password."
                  className="cursor-help text-gray-400 font-normal">ⓘ</span>
              </p>
            </div>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="6-digit PIN (e.g. 123456)"
                maxLength={6}
                value={registerPin}
                onChange={e => setRegisterPin(e.target.value.replace(/\D/g, ''))}
              />
              <button onClick={registerNumber} disabled={registering || registerPin.length !== 6}
                className="btn-primary text-sm px-4 disabled:opacity-50 whitespace-nowrap">
                {registering ? 'Registering…' : 'Register'}
              </button>
            </div>
          </div>
        </div>

        {/* SECTION: Google Contacts */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Google Contacts</h2>
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${googleCreds?.connected ? 'bg-green-50' : 'bg-gray-100'}`}>
                <ContactIcon size={16} className={googleCreds?.connected ? 'text-green-600' : 'text-gray-500'} />
              </div>
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                Two-way sync
                <span
                  title="Opt-in per contact, from the Contacts tab — nothing syncs to your personal Google account by default. Google is authoritative for name/phone/email on synced contacts (with a conflict recorded, not silently overwritten, if both sides changed); opt-in status, credit limit, and other business fields never leave this app."
                  className="cursor-help text-gray-400 font-normal">ⓘ</span>
              </p>
            </div>

            {googleCreds?.connected ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm text-gray-700">Connected{googleCreds.connectedAccountEmail ? ` as ${googleCreds.connectedAccountEmail}` : ''}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Runs automatically every 6 hours, or sync now.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={syncGoogleNow} disabled={syncingGoogle} className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50">
                    {syncingGoogle ? 'Syncing…' : 'Sync Now'}
                  </button>
                  <button onClick={disconnectGoogle} className="text-xs text-red-500 hover:text-red-700 px-2">Disconnect</button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-500 mb-3">
                  {googleCreds?.configured
                    ? 'Not connected yet.'
                    : 'Not set up yet — needs a Google Cloud project and OAuth client (see backend/.env.example for the one-time setup steps).'}
                </p>
                <button onClick={connectGoogle} disabled={!googleCreds?.configured || connectingGoogle}
                  className="btn-primary text-sm px-4 disabled:opacity-50">
                  {connectingGoogle ? 'Redirecting…' : 'Connect Google Account'}
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
      )}

      {/* ── Templates tab ── */}
      {isSuperAdmin && tab === 'templates' && <div className="space-y-8">

      {/* ── New template form ── */}
      {showForm && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Plus size={16} className="text-blue-600" />
              </div>
              <h2 className="text-sm font-semibold text-gray-900">New Template</h2>
            </div>
            <button onClick={() => { setShowForm(false); setForm({ ...BLANK_FORM }); }}
              className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label text-sm">Name <span className="text-gray-400 font-normal text-xs">(lowercase_underscores)</span></label>
              <input className="input" placeholder="svn_order_placed"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label text-sm">Category</label>
              <select className="input" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as typeof form.category }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-sm">Language</label>
              <select className="input" value={form.language}
                onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label text-sm">Header <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <input className="input" placeholder="Srivani Stores"
              value={form.headerText}
              onChange={e => setForm(f => ({ ...f, headerText: e.target.value }))} />
          </div>

          <div>
            <label className="label text-sm">Body <span className="text-red-500">*</span></label>
            <textarea rows={3} className="input"
              placeholder="Hello {{1}}, your order *{{2}}* has been placed. Total: ₹{{3}}"
              value={form.bodyText}
              onChange={e => setForm(f => ({ ...f, bodyText: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">Use {'{{1}}'}, {'{{2}}'} etc. for dynamic values</p>
          </div>

          <div>
            <label className="label text-sm">Footer <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <input className="input" placeholder="- Team Srivani Stores"
              value={form.footerText}
              onChange={e => setForm(f => ({ ...f, footerText: e.target.value }))} />
          </div>

          <div>
            <label className="label text-sm">Buttons <span className="text-gray-400 font-normal text-xs">(optional — Meta doesn&apos;t allow mixing Quick Reply with Call/Website)</span></label>
            <div className="flex gap-2 mb-2">
              {(['none', 'quick_reply', 'cta'] as const).map(mode => (
                <button key={mode} type="button"
                  onClick={() => setForm(f => ({ ...f, buttonMode: mode }))}
                  className={`text-xs px-2.5 py-1 rounded-lg border ${form.buttonMode === mode ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {mode === 'none' ? 'No buttons' : mode === 'quick_reply' ? 'Quick Reply' : 'Call / Website'}
                </button>
              ))}
            </div>

            {form.buttonMode === 'quick_reply' && (
              <div className="space-y-1.5">
                {form.quickReplies.map((q, i) => (
                  <input key={i} className="input text-sm" placeholder={`Button ${i + 1} (e.g. "Confirm")`}
                    value={q}
                    onChange={e => setForm(f => { const qr = [...f.quickReplies]; qr[i] = e.target.value; return { ...f, quickReplies: qr }; })} />
                ))}
              </div>
            )}

            {form.buttonMode === 'cta' && (
              <div className="grid grid-cols-2 gap-2">
                <input className="input text-sm" placeholder="Call button text (e.g. Call Store)"
                  value={form.ctaCallText}
                  onChange={e => setForm(f => ({ ...f, ctaCallText: e.target.value }))} />
                <input className="input text-sm" placeholder="Phone number (91XXXXXXXXXX)"
                  value={form.ctaCallPhone}
                  onChange={e => setForm(f => ({ ...f, ctaCallPhone: e.target.value }))} />
                <input className="input text-sm" placeholder="Website button text (e.g. Track Order)"
                  value={form.ctaWebText}
                  onChange={e => setForm(f => ({ ...f, ctaWebText: e.target.value }))} />
                <input className="input text-sm" placeholder="https://shop.srivani.com"
                  value={form.ctaWebUrl}
                  onChange={e => setForm(f => ({ ...f, ctaWebUrl: e.target.value }))} />
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => { setShowForm(false); setForm({ ...BLANK_FORM }); }} className="btn-outline text-sm">Cancel</button>
            <button onClick={submit} disabled={submitting} className="btn-primary text-sm">
              {submitting ? 'Submitting…' : 'Submit to Meta for Approval'}
            </button>
          </div>
        </div>
      )}

      {/* ── Templates list ── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Your Templates {!loading && `(${templates.length})`}
        </h2>

        {loading ? (
          <div className="text-center py-10 text-gray-400 text-sm">Loading templates…</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl text-gray-400">
            <MessageSquare size={30} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No templates loaded.</p>
            <p className="text-xs mt-1">Check your connection above or use Quick-add below.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map(t => {
              const approved = t.status === 'APPROVED';
              const pending  = t.status === 'PENDING';
              const rejected = t.status === 'REJECTED';
              return (
                <div key={t.name}
                  className={`bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow border-l-4
                    ${approved ? 'border-l-green-500' : pending ? 'border-l-yellow-400' : rejected ? 'border-l-red-400' : 'border-l-gray-300'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-gray-800">{t.name}</span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium
                          ${approved ? 'bg-green-50 text-green-700 border-green-200'
                          : pending  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          : rejected ? 'bg-red-50 text-red-600 border-red-200'
                                     : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {approved ? <CheckCircle2 size={11} /> : pending ? <Clock size={11} /> : <XCircle size={11} />}
                          {t.status}
                        </span>
                        <span className="text-xs text-gray-400">{t.category} · {t.language}</span>
                      </div>
                      {TEMPLATE_DESC[t.name] && (
                        <p className="text-xs text-blue-600 mt-0.5">{TEMPLATE_DESC[t.name]}</p>
                      )}
                      <p className="text-sm text-gray-600 mt-2 leading-relaxed">{bodyPreview(t)}</p>
                      {rejected && t.rejected_reason && t.rejected_reason !== 'NONE' && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle size={11} /> {t.rejected_reason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {approved && (
                        <button onClick={() => openSendModal(t)}
                          className="flex items-center gap-1.5 text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg px-3 py-1.5 transition-colors font-medium">
                          <PlayCircle size={13} /> Send Test
                        </button>
                      )}
                      <button onClick={() => remove(t.name)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Required templates checklist ── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Setup Checklist</h2>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${missingRequired.length > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
              {missingRequired.length > 0
                ? <AlertCircle size={16} className="text-orange-500" />
                : <CheckCircle2 size={16} className="text-green-600" />}
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {missingRequired.length === 0
                ? 'All required templates are ready!'
                : `${missingRequired.length} template${missingRequired.length > 1 ? 's' : ''} still needed`}
            </p>
          </div>
          <div className="space-y-2">
            {REQUIRED_TEMPLATES.map(r => {
              const exists = existingNames.has(r.name);
              return (
                <div key={r.name}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border
                    ${exists ? 'bg-green-50/40 border-green-200' : 'bg-gray-50/60 border-gray-200'}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    {exists
                      ? <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                      : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />}
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-semibold text-gray-800">{r.name}</span>
                      <p className="text-xs text-gray-500 truncate">{TEMPLATE_DESC[r.name] ?? ''}</p>
                    </div>
                  </div>
                  {!exists && (
                    <button
                      onClick={() => {
                        setForm({
                          ...BLANK_FORM,
                          name: r.name, category: 'UTILITY', language: 'en',
                          headerText: r.headerText ?? 'Srivani Stores',
                          bodyText: r.body, footerText: r.footer,
                          buttonMode: r.buttonMode ?? 'none',
                          quickReplies: r.quickReplies ?? ['', '', ''],
                          ctaWebText: r.ctaWebText ?? '',
                          ctaWebUrl: r.ctaWebUrl ?? feedbackSettings.googleReviewUrl ?? '',
                        });
                        setShowForm(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg px-2.5 py-1 font-medium whitespace-nowrap transition-colors">
                      <Plus size={11} /> Create
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Template gallery — browsable starting points, pick anytime ── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Template Gallery</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TEMPLATE_PRESETS.map(preset => (
            <div key={preset.name} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <span>{preset.emoji}</span> {preset.name}
                </p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                  preset.category === 'MARKETING' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {preset.category}
                </span>
              </div>
              <p className="text-xs text-gray-500 flex-1 mb-3">{preset.description}</p>
              <button
                onClick={() => {
                  setForm({
                    ...BLANK_FORM,
                    name: preset.name, category: preset.category, language: 'en',
                    headerText: preset.headerText ?? '',
                    bodyText: preset.body, footerText: preset.footer ?? '',
                    buttonMode: preset.buttonMode ?? 'none',
                    quickReplies: preset.quickReplies ?? ['', '', ''],
                    ctaWebText: preset.ctaWebText ?? '', ctaWebUrl: preset.ctaWebUrl ?? '',
                  });
                  setShowForm(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg px-2.5 py-1.5 font-medium transition-colors">
                <Plus size={11} /> Use this template
              </button>
            </div>
          ))}
        </div>
      </div>

      </div>}

      {/* ── Campaigns tab ── */}
      {isSuperAdmin && tab === 'campaigns' && (() => {
        const approvedTemplates = templates.filter(t => t.status === 'APPROVED');
        const broadcastTemplate = approvedTemplates.find(t => t.name === broadcastTemplateName);
        const broadcastVarCount = broadcastTemplate ? varCount(broadcastTemplate) : 0;
        const selectedSegmentObj = segments.find(s => s.id === selectedSegment);
        return (
      <div className="space-y-8">
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Broadcast</h2>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <Megaphone size={16} className="text-purple-500" />
            </div>
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              Broadcast Campaign
              <span
                title="Sends an approved template to every customer in the chosen segment. Only reaches customers with WhatsApp opt-in enabled on their profile. If the template has {{1}}, {{2}} etc. variables, the same value is sent to every recipient — not personalized per name."
                className="cursor-help text-gray-400 font-normal">ⓘ</span>
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select className="input text-sm" value={selectedSegment} onChange={e => setSelectedSegment(e.target.value)}>
              <option value="">Choose segment…</option>
              {segments.map(s => <option key={s.id} value={s.id}>{s.label} ({s.count})</option>)}
            </select>
            <select className="input text-sm" value={broadcastTemplateName} onChange={e => { setBroadcastTemplateName(e.target.value); setBroadcastParams([]); }}>
              <option value="">Choose template…</option>
              {approvedTemplates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
            <button
              onClick={sendBroadcast}
              disabled={sendingBroadcast || !selectedSegment || !broadcastTemplateName || !selectedSegmentObj?.count}
              className="btn-primary flex items-center justify-center gap-1.5 text-sm disabled:opacity-40"
            >
              <Send size={13} /> {sendingBroadcast ? 'Sending…' : 'Send Broadcast'}
            </button>
          </div>
          {broadcastVarCount > 0 && (
            <div className="mt-3 space-y-1.5">
              <label className="label text-xs">Template variables <span className="text-gray-400 font-normal">(same value sent to everyone)</span></label>
              {Array.from({ length: broadcastVarCount }, (_, i) => (
                <input key={i} className="input text-sm" placeholder={`Value for {{${i + 1}}}`}
                  value={broadcastParams[i] ?? ''}
                  onChange={e => setBroadcastParams(p => { const next = [...p]; next[i] = e.target.value; return next; })} />
              ))}
            </div>
          )}
          {selectedSegmentObj && selectedSegmentObj.count === 0 && (
            <p className="text-xs text-amber-600 mt-2">No customers currently match this segment.</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Cake size={13} className="text-pink-400" /> Today&apos;s Birthdays {!birthdaysLoading && `(${birthdays.length})`}
            <span
              title="Customers need a saved Date of Birth and WhatsApp opt-in (both set on their customer profile) to appear here. Sending uses an approved template — free-text greetings can't reach customers outside the 24h session window."
              className="cursor-help text-gray-400 normal-case font-normal">ⓘ</span>
          </h2>
          <button onClick={loadBirthdays} className="btn-outline flex items-center gap-1.5 text-xs px-2 py-1">
            <RefreshCw size={12} />
          </button>
        </div>

        {birthdaysLoading ? (
          <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
        ) : birthdays.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-gray-200 rounded-2xl text-gray-400">
            <Cake size={30} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No birthdays today.</p>
            <p className="text-xs mt-1">Customers need a Date of Birth saved and WhatsApp opt-in enabled to show up here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {birthdays.map(c => {
              const approved = templates.filter(t => t.status === 'APPROVED');
              const picked = approved.find(t => t.name === birthdayTemplatePick[c.id]);
              return (
                <div key={c.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-pink-50 flex items-center justify-center text-xs font-bold text-pink-500 shrink-0">
                      {c.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.phone ? `+${c.phone}` : 'No phone on file'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      className="input text-xs h-7 py-0"
                      value={birthdayTemplatePick[c.id] ?? ''}
                      onChange={e => setBirthdayTemplatePick(m => ({ ...m, [c.id]: e.target.value }))}
                    >
                      <option value="">Choose template…</option>
                      {approved.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                    </select>
                    <button
                      onClick={() => { if (picked && c.phone) openSendModalForPhone(picked, c.phone); }}
                      disabled={!picked || !c.phone}
                      className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5 disabled:opacity-40"
                    >
                      <Send size={12} /> Send
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
        );
      })()}

      {/* ── Settings tab: message log ── */}
      {isSuperAdmin && tab === 'settings' && (
      <div className="max-w-3xl">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Activity</h2>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
            Message Log {!waLoading && `(${waTotal})`}
            <span
              title="Sent = accepted by Meta. Delivered = reached the customer's phone. Read = customer opened it. Meta only allows free-form / interactive messages to reach customers who messaged your number in the last 24 hours — templates are the only way to reach outside that window."
              className="cursor-help text-gray-400 normal-case font-normal">ⓘ</span>
          </p>
          <div className="flex items-center gap-2">
            <select className="input text-xs h-7 py-0" value={waDirFilter}
              onChange={e => { setWaPage(1); setWaDirFilter(e.target.value as typeof waDirFilter); }}>
              <option value="">All directions</option>
              <option value="OUTBOUND">Sent by store</option>
              <option value="INBOUND">Received</option>
            </select>
            <select className="input text-xs h-7 py-0" value={waStatusFilter}
              onChange={e => { setWaPage(1); setWaStatusFilter(e.target.value as typeof waStatusFilter); }}>
              <option value="">All statuses</option>
              {Object.entries(MSG_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={loadMessages} className="btn-outline flex items-center gap-1.5 text-xs px-2 py-1">
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {waLoading ? (
          <div className="text-center py-10 text-gray-400 text-sm">Loading message log…</div>
        ) : waMessages.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl text-gray-400">
            <MessageSquare size={30} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No messages logged yet.</p>
            <p className="text-xs mt-1">Sends and receives will appear here once WhatsApp is active.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {waMessages.map(m => {
              const st = MSG_STATUS_CONFIG[m.status] ?? MSG_STATUS_CONFIG.QUEUED;
              const isOpen = m.id === waExpanded;
              const date = new Date(m.createdAt);
              const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
              const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={m.id}
                  className={`bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow border-l-4
                    ${m.status === 'FAILED' ? 'border-l-red-400' : m.direction === 'INBOUND' ? 'border-l-purple-400' : 'border-l-blue-400'}`}>
                  <div className="flex items-center gap-3 p-3.5 cursor-pointer" onClick={() => setWaExpanded(isOpen ? null : m.id)}>
                    <div className="shrink-0" title={m.direction === 'OUTBOUND' ? 'Sent by store' : 'Received from customer'}>
                      {m.direction === 'OUTBOUND'
                        ? <ArrowUpRight size={14} className="text-blue-500" />
                        : <ArrowDownLeft size={14} className="text-purple-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-900">+{m.phone}</span>
                        <span className="text-xs text-gray-400">{m.messageType}{m.templateName ? ` · ${m.templateName}` : ''}</span>
                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border ${st.color}`}>
                          {st.icon} {st.label}
                        </span>
                        {m.buttonId && (
                          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                            <MousePointerClick size={11} /> Button tap
                          </span>
                        )}
                      </div>
                      {m.bodyPreview && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{m.bodyPreview}</p>
                      )}
                      {m.errorMessage && (
                        <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                          <AlertCircle size={10} /> {m.errorMessage}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.relatedType === 'ONLINE_ORDER' && m.relatedId && (
                        <span className="text-xs text-gray-400 font-mono">{m.relatedId}</span>
                      )}
                      <span className="text-xs text-gray-400">{dateStr} {timeStr}</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-1 text-xs text-gray-500">
                      <div className="flex gap-6 flex-wrap">
                        <span><span className="font-medium">Phone:</span> +{m.phone}</span>
                        <span><span className="font-medium">Type:</span> {m.messageType}</span>
                        <span><span className="font-medium">Status:</span> {st.label}</span>
                        {m.relatedType && m.relatedId && (
                          <span><span className="font-medium">{m.relatedType}:</span> {m.relatedId}</span>
                        )}
                      </div>
                      {m.bodyPreview && (
                        <p className="mt-1"><span className="font-medium">Content:</span> {m.bodyPreview}</p>
                      )}
                      {m.errorMessage && (
                        <p className="mt-1 text-red-500"><span className="font-medium">Error:</span> {m.errorMessage}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {waTotal > WA_LIMIT && (
          <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: Math.ceil(waTotal / WA_LIMIT) }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setWaPage(p)}
                className={`text-xs px-3 py-1.5 rounded-lg border ${p === waPage ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
      )}

    </div>

    {/* ── Add/Edit phone number modal ── */}
    {showNumberForm && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone size={18} className="text-gray-600" />
              <h3 className="font-semibold text-gray-900">{editingNumberId ? 'Edit Number' : 'Add Number'}</h3>
            </div>
            <button onClick={() => { setShowNumberForm(false); setNumberForm({ ...BLANK_NUMBER_FORM }); setEditingNumberId(null); }}
              className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>

          <div>
            <label className="label text-sm">Label</label>
            <input className="input" placeholder="e.g. Sangareddy Store, Test Sandbox"
              value={numberForm.label}
              onChange={e => setNumberForm(f => ({ ...f, label: e.target.value }))} />
          </div>
          <div>
            <label className="label text-sm">Access Token {editingNumberId && <span className="text-gray-400 font-normal text-xs">(leave blank to keep existing)</span>}</label>
            <input className="input font-mono text-xs" placeholder="EAAd…"
              value={numberForm.accessToken}
              onChange={e => setNumberForm(f => ({ ...f, accessToken: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-sm">Phone Number ID</label>
              <input className="input text-sm" placeholder="1236691106193092"
                value={numberForm.phoneNumberId}
                onChange={e => setNumberForm(f => ({ ...f, phoneNumberId: e.target.value }))} />
            </div>
            <div>
              <label className="label text-sm">Business Account ID</label>
              <input className="input text-sm" placeholder="4470398083206478"
                value={numberForm.businessAccountId}
                onChange={e => setNumberForm(f => ({ ...f, businessAccountId: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label text-sm">Store Notify Number <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <input className="input text-sm" placeholder="919382828484"
              value={numberForm.storeNotifyNumber}
              onChange={e => setNumberForm(f => ({ ...f, storeNotifyNumber: e.target.value }))} />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => { setShowNumberForm(false); setNumberForm({ ...BLANK_NUMBER_FORM }); setEditingNumberId(null); }} className="btn-outline text-sm">Cancel</button>
            <button onClick={saveNumber} disabled={savingNumber} className="btn-primary text-sm">
              {savingNumber ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Credentials modal ── */}
    {showCredsModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound size={18} className="text-gray-600" />
              <h3 className="font-semibold text-gray-900">Update WhatsApp Credentials</h3>
            </div>
            <button onClick={() => { setShowCredsModal(false); setCreds({ ...BLANK_CREDS }); }}
              className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 leading-relaxed">
            Only fill the fields you want to update — leave others blank to keep existing values.
            Token expires every ~24 h. Get a new one from Meta Developer → WhatsApp → API Setup → Generate access token.
          </div>

          <div>
            <label className="label text-sm">Access Token</label>
            <input className="input font-mono text-xs" placeholder="EAAd…"
              value={creds.token}
              onChange={e => setCreds(c => ({ ...c, token: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-sm">Phone Number ID</label>
              <input className="input text-sm" placeholder="1092826743922168"
                value={creds.phoneId}
                onChange={e => setCreds(c => ({ ...c, phoneId: e.target.value }))} />
            </div>
            <div>
              <label className="label text-sm">Business Account ID</label>
              <input className="input text-sm" placeholder="1573200934238105"
                value={creds.wabaId}
                onChange={e => setCreds(c => ({ ...c, wabaId: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label text-sm">Store Notify Number</label>
            <input className="input text-sm" placeholder="919382828484"
              value={creds.storeNum}
              onChange={e => setCreds(c => ({ ...c, storeNum: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">This number receives a WhatsApp alert for every new order</p>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => { setShowCredsModal(false); setCreds({ ...BLANK_CREDS }); }} className="btn-outline text-sm">Cancel</button>
            <button onClick={saveCreds} disabled={savingCreds} className="btn-primary text-sm">
              {savingCreds ? 'Saving…' : 'Save Credentials'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Send template modal ── */}
    {sendModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Send Template</h3>
            <button onClick={() => setSendModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>

          <div>
            <label className="label text-sm">Template</label>
            {templates.filter(t => t.status === 'APPROVED').length > 1 ? (
              <select
                className="input text-sm font-mono"
                value={sendModal.template.name}
                onChange={e => {
                  const t = templates.find(x => x.name === e.target.value);
                  if (t) setSendModal(m => {
                    if (!m) return null;
                    const params = Array(varCount(t)).fill('');
                    if (params.length > 0 && m.params[0]) params[0] = m.params[0];
                    return { ...m, template: t, params, urlButtonParam: '' };
                  });
                }}
              >
                {templates.filter(t => t.status === 'APPROVED').map(t => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-gray-500 font-mono">{sendModal.template.name}</p>
            )}
          </div>

          {/* WhatsApp message bubble */}
          <div className="bg-[#dcf8c6] rounded-xl rounded-tl-none p-3.5 text-sm text-gray-800 leading-relaxed shadow-sm">
            {bodyPreview(sendModal.template)}
          </div>

          <div>
            {sendModal.mode === 'bulk' ? (
              <>
                <label className="label text-sm">Sending to</label>
                <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  {sendModal.ids.length} selected contact{sendModal.ids.length !== 1 ? 's' : ''}
                </p>
              </>
            ) : (
              <>
                <label className="label text-sm">Send to (phone number)</label>
                <input className="input" placeholder="93828 28484"
                  value={sendModal.phone}
                  onChange={e => setSendModal(m => (m && m.mode === 'single') ? { ...m, phone: e.target.value } : m)} />
              </>
            )}
          </div>

          {hasDynamicUrlButton(sendModal.template) && (
            <div>
              <label className="label text-sm">Link value (goes into the button's URL)</label>
              <input className="input text-sm" placeholder="e.g. a customer's unique token/ID"
                value={sendModal.urlButtonParam}
                onChange={e => setSendModal(m => m ? { ...m, urlButtonParam: e.target.value } : null)} />
              <p className="text-xs text-gray-400 mt-1">This template's button links to a per-recipient page — Meta requires this value or the whole send is rejected.</p>
            </div>
          )}

          {sendModal.params.length > 0 && (
            <div className="space-y-2">
              <label className="label text-sm">Fill in the variables</label>
              {sendModal.params.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-8 text-right font-mono shrink-0">{`{{${i + 1}}}`}</span>
                  <input className="input flex-1 text-sm" placeholder={`Value for {{${i + 1}}}`}
                    value={p}
                    onChange={e => setSendModal(m => {
                      if (!m) return null;
                      const params = [...m.params];
                      params[i] = e.target.value;
                      return { ...m, params };
                    })} />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setSendModal(null)} className="btn-outline text-sm">Cancel</button>
            <button onClick={sendFromModal} disabled={sendModal.sending}
              className="btn-primary flex items-center gap-1.5 text-sm">
              <Send size={13} /> {sendModal.sending ? 'Sending…' : 'Send Message'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
