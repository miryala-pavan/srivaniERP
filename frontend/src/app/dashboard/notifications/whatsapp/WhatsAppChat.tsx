'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Send, Search, Clock, MessageSquare, Paperclip, Bot,
  Check, CheckCheck, AlertCircle, Pencil, ExternalLink, ShoppingBag, Award, Receipt,
  MapPin, FileText, SmilePlus, Pin, PinOff, CheckCircle2, Circle, Tag, X, Plus,
  ChevronLeft, StickyNote, Zap, UserCircle2, MessageSquarePlus, Bell,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { useReportParams } from '@/hooks/useReportParams';
import { Avatar } from '@/components/shared/Avatar';
import SavedViews from '@/components/reports/SavedViews';

const PUSH_BANNER_DISMISSED_KEY = 'wa_push_banner_dismissed';

interface Conversation {
  phone: string;
  customerName: string | null;
  customerId: string | null;
  outstandingDue: number | null;
  lastMessage: string | null;
  lastMessageType: string;
  lastDirection: 'OUTBOUND' | 'INBOUND';
  lastAt: string;
  lastStatus: string;
  unreadCount: number;
  convStatus?: 'OPEN' | 'RESOLVED';
  pinned?: boolean;
  labels?: string[];
  assignedToUserId?: string | null;
  assignedToName?: string | null;
}

interface StaffMember {
  id: string;
  fullName: string;
}

interface ThreadMessage {
  id: string;
  waMessageId: string;
  direction: 'OUTBOUND' | 'INBOUND';
  phone: string;
  messageType: string;
  templateName: string | null;
  bodyPreview: string | null;
  buttonId: string | null;
  mediaId: string | null;
  isAutoReply: boolean;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🙏', '👌'];

function ChatImage({ mediaId }: { mediaId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    api.get(`/notifications/whatsapp/media/${mediaId}`, { responseType: 'blob' })
      .then(res => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setSrc(objectUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId]);

  if (failed) return <p className="text-xs text-gray-400 italic">Image unavailable</p>;
  if (!src) return <div className="w-48 h-48 bg-gray-100 rounded-lg animate-pulse" />;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer">
      <img src={src} alt="Sent image" className="max-w-[240px] max-h-[240px] rounded-lg object-cover" />
    </a>
  );
}

function ConversationRowSkeleton() {
  return (
    <div className="px-3.5 py-3 flex items-center gap-2.5 border-b border-gray-50">
      <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse shrink-0" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3 w-2/5 bg-gray-100 rounded animate-pulse" />
        <div className="h-2.5 w-3/5 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  );
}

function ThreadSkeleton() {
  const widths = ['w-40', 'w-56', 'w-32', 'w-48'];
  return (
    <>
      {widths.map((w, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
          <div className={`h-9 ${w} bg-white/70 rounded-2xl animate-pulse`} />
        </div>
      ))}
    </>
  );
}

interface WaMessageEvent {
  phone: string;
  direction: 'OUTBOUND' | 'INBOUND';
  bodyPreview: string | null;
  messageType: string;
  createdAt: string;
}

interface CannedReply {
  id: string;
  title: string;
  body: string;
  category: string | null;
}

interface InternalNote {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
}

interface ContactInfo {
  phone: string;
  customerId: string | null;
  name: string | null;
  email: string | null;
  customerCode: string | null;
  outstandingBalance: string | null;
  creditLimit: string | null;
  loyaltyPoints: number | null;
  orderCount: number;
  lastOrder: { orderNumber: string; status: string; total: string; createdAt: string } | null;
  posBillCount: number;
  lastPosBill: { billNumber: string | null; grandTotal: string; billDate: string } | null;
}

function StatusTick({ status }: { status: string }) {
  if (status === 'FAILED') return <span title="Failed to send"><AlertCircle size={12} className="text-red-400" /></span>;
  if (status === 'READ')   return <span title="Read"><CheckCheck size={13} className="text-blue-500" /></span>;
  if (status === 'DELIVERED') return <span title="Delivered"><CheckCheck size={13} className="text-gray-400" /></span>;
  if (status === 'SENT')   return <span title="Sent"><Check size={13} className="text-gray-400" /></span>;
  return <span title="Queued"><Clock size={11} className="text-gray-300" /></span>;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function fmtRelative(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

interface WhatsAppChatProps {
  /** Opens the Send Template modal (owned by the parent page — Meta requires
   * an approved template for a number with no open session) pre-filled with
   * the given phone, then selects that conversation here so the existing
   * wa.message.sent listener below picks up the send once it lands. */
  onStartNewChat?: (phone: string, name?: string) => void;
}

export default function WhatsAppChat({ onStartNewChat }: WhatsAppChatProps) {
  const push = usePushSubscription();
  const [pushBannerDismissed, setPushBannerDismissed] = useState(true); // default true — flips false only after checking localStorage client-side, avoids SSR flash
  const searchParams = useSearchParams();
  // Raw window.location.search reads/writes (history.replaceState), separate
  // from Next's router-managed useSearchParams() above which only tracks the
  // ?phone= deep link — SavedViews restores filters via a full reload, so
  // the two mechanisms never need to live-sync with each other.
  const params = useReportParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading]     = useState(true);
  const [search, setSearch]               = useState(() => params.get('q', ''));
  const [msgSearchPhones, setMsgSearchPhones] = useState<Set<string> | null>(null);
  // Address-book matches for the current search — people in the Customers
  // directory with no message thread yet, so they'd otherwise be invisible
  // in this tab (which only ever lists existing conversations).
  const [addressBookMatches, setAddressBookMatches] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [unreadOnly, setUnreadOnly]       = useState(() => params.get('unread') === '1');
  const [showResolved, setShowResolved]   = useState(() => params.get('resolved') === '1');
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(() => params.get('mine') === '1');
  const [waitingOnly, setWaitingOnly]     = useState(() => params.get('waiting') === '1');
  const [vipOnly, setVipOnly]             = useState(() => params.get('vip') === '1');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [activeIndex, setActiveIndex]     = useState(-1);
  const currentUser = getUser<{ userId?: string; id?: string; fullName?: string }>();
  const currentUserId = currentUser?.userId ?? currentUser?.id ?? null;

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [showAssignPopover, setShowAssignPopover] = useState(false);
  const [showNewChat, setShowNewChat]     = useState(false);
  const [newChatPhone, setNewChatPhone]   = useState('');
  const [newChatMatches, setNewChatMatches] = useState<{ id: string; name: string; phone: string; hasConversation: boolean }[]>([]);
  const [newChatActiveIndex, setNewChatActiveIndex] = useState(-1);
  const [newChatOpen, setNewChatOpen]     = useState(false);
  const newChatDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Below the `lg` breakpoint, only one of these three panes is visible at a
  // time (WhatsApp-app style) — at `lg`+ this is ignored, all three panes
  // show side-by-side as before. Selecting a conversation never clears
  // selectedPhone, so resizing the window above `lg` mid-navigation still
  // shows the last-opened thread.
  const [mobileView, setMobileView] = useState<'list' | 'thread' | 'contact'>('list');

  const [messages, setMessages]         = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sessionOpen, setSessionOpen]   = useState<boolean | null>(null);
  const [windowExpiresAt, setWindowExpiresAt] = useState<string | null>(null);
  const [replyText, setReplyText]       = useState('');
  const [sending, setSending]           = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [reactingTo, setReactingTo]     = useState<string | null>(null);

  const [contact, setContact]           = useState<ContactInfo | null>(null);
  const [editingName, setEditingName]   = useState(false);
  const [nameInput, setNameInput]       = useState('');
  const [savingName, setSavingName]     = useState(false);
  const [labelInput, setLabelInput]     = useState('');
  const [savingMeta, setSavingMeta]     = useState(false);

  // Pane 3 (contact panel) Info/Notes tab switch
  const [contactTab, setContactTab] = useState<'info' | 'notes'>('info');
  const [notes, setNotes]           = useState<InternalNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteInput, setNoteInput]   = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Canned/quick replies — fetched once (business-wide, not per-conversation).
  // Popover visibility is derived (replyText starts with "/"), not its own
  // state — see cannedFilterText below.
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([]);
  const [cannedIndex, setCannedIndex] = useState(0);

  const threadEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const selectedPhoneRef = useRef<string | null>(null);
  selectedPhoneRef.current = selectedPhone;
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newChatContainerRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/whatsapp/conversations');
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load conversations');
    } finally {
      setConvLoading(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    try { setPushBannerDismissed(localStorage.getItem(PUSH_BANNER_DISMISSED_KEY) === '1'); } catch {}
  }, []);

  function dismissPushBanner() {
    setPushBannerDismissed(true);
    try { localStorage.setItem(PUSH_BANNER_DISMISSED_KEY, '1'); } catch {}
  }

  async function enablePush() {
    const ok = await push.subscribe();
    if (ok) { toast.success('Notifications enabled'); dismissPushBanner(); }
    else if (push.permission === 'denied') toast.error('Notifications blocked — enable them in your browser\'s site settings');
    else toast.error('Could not enable notifications');
  }

  // Deep-link from a push notification click (sw.js navigates to
  // ?phone=<number>) — select that conversation once conversations exist.
  useEffect(() => {
    const phone = searchParams?.get('phone');
    if (phone) { setSelectedPhone(phone); setMobileView('thread'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    api.get('/notifications/whatsapp/canned-replies')
      .then(({ data }) => setCannedReplies(Array.isArray(data) ? data : []))
      .catch(() => setCannedReplies([]));
  }, []);

  useEffect(() => {
    api.get('/users')
      .then(({ data }) => setStaffList(Array.isArray(data) ? data.map((u: any) => ({ id: u.id, fullName: u.fullName })) : []))
      .catch(() => setStaffList([]));
  }, []);

  // Debounced message-content search — hits the backend so results aren't
  // limited to conversations already in the loaded list's name/phone.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = search.trim();
    if (q.length < 2) { setMsgSearchPhones(null); setAddressBookMatches([]); params.set({ q: q || null }); return; }
    searchDebounceRef.current = setTimeout(async () => {
      params.set({ q: q || null });
      try {
        const { data } = await api.get('/notifications/whatsapp/conversations/search', { params: { q } });
        const rows = Array.isArray(data) ? data : [];
        setMsgSearchPhones(new Set(rows.map((r: any) => r.phone)));
      } catch {
        setMsgSearchPhones(null);
      }
      try {
        const { data } = await api.get('/customers', { params: { search: q, limit: 5 } });
        const rows = Array.isArray(data?.data) ? data.data : [];
        const existingPhones = new Set(conversations.map((c) => c.phone));
        setAddressBookMatches(
          rows
            .filter((c: any) => c.phone && !existingPhones.has(`91${c.phone}`))
            .map((c: any) => ({ id: c.id, name: c.name, phone: c.phone })),
        );
      } catch {
        setAddressBookMatches([]);
      }
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [search, conversations]);

  // Debounced contact search for the "New Chat" box — same 300ms/2-char
  // threshold as the conversation search above, kept independent since this
  // is a different input entirely.
  useEffect(() => {
    if (newChatDebounceRef.current) clearTimeout(newChatDebounceRef.current);
    const q = newChatPhone.trim();
    if (q.length < 2) { setNewChatMatches([]); return; }
    newChatDebounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/customers', { params: { search: q, limit: 8 } });
        const rows = Array.isArray(data?.data) ? data.data : [];
        const existingPhones = new Set(conversations.map((c) => c.phone));
        setNewChatMatches(
          rows
            .filter((c: any) => c.phone)
            .map((c: any) => ({ id: c.id, name: c.name, phone: c.phone, hasConversation: existingPhones.has(`91${c.phone}`) })),
        );
      } catch {
        setNewChatMatches([]);
      }
    }, 300);
    return () => { if (newChatDebounceRef.current) clearTimeout(newChatDebounceRef.current); };
  }, [newChatPhone, conversations]);

  // The "start new chat with +91 XXXXX XXXXX" row — only offered once the
  // typed text is unambiguously a valid Indian mobile number, and only when
  // it isn't already one of the matched contacts above (avoids offering a
  // redundant "start new" action for someone who's right there in the list).
  const newChatValidNumber = (() => {
    const digits = newChatPhone.replace(/\D/g, '');
    const local = digits.length >= 10 ? digits.slice(-10) : digits;
    if (!/^[6-9]\d{9}$/.test(local)) return null;
    if (newChatMatches.some(m => m.phone === local)) return null;
    return local;
  })();

  const newChatRows: Array<{ kind: 'contact'; contact: typeof newChatMatches[number] } | { kind: 'new'; phone: string }> = [
    ...newChatMatches.map(contact => ({ kind: 'contact' as const, contact })),
    ...(newChatValidNumber ? [{ kind: 'new' as const, phone: newChatValidNumber }] : []),
  ];

  function selectNewChatRow(row: typeof newChatRows[number]) {
    if (row.kind === 'new') {
      startNewChat(row.phone);
    } else if (row.contact.hasConversation) {
      setShowNewChat(false);
      setNewChatPhone('');
      setNewChatOpen(false);
      setSelectedPhone(`91${row.contact.phone}`);
      setMobileView('thread');
    } else {
      startNewChat(row.contact.phone);
    }
    setNewChatOpen(false);
  }

  // Close the New Chat dropdown on outside click — same approach as
  // FieldHelp's popover (components/ui/FieldHelp.tsx).
  useEffect(() => {
    if (!newChatOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (newChatContainerRef.current && !newChatContainerRef.current.contains(e.target as Node)) {
        setNewChatOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [newChatOpen]);

  // Reset the search box's own state whenever the New Chat panel is toggled
  // shut, so reopening it doesn't show stale matches from the last search.
  useEffect(() => {
    if (!showNewChat) { setNewChatPhone(''); setNewChatMatches([]); setNewChatActiveIndex(-1); setNewChatOpen(false); }
  }, [showNewChat]);

  const loadThread = useCallback(async (phone: string) => {
    setThreadLoading(true);
    try {
      const [msgRes, winRes] = await Promise.all([
        api.get(`/notifications/whatsapp/conversations/${phone}/messages`),
        api.get(`/notifications/whatsapp/conversations/${phone}/window`),
      ]);
      setMessages((msgRes.data?.items ?? []).slice().reverse());
      setSessionOpen(winRes.data?.open ?? false);
      setWindowExpiresAt(winRes.data?.expiresAt ?? null);
      api.patch(`/notifications/whatsapp/conversations/${phone}/read`).catch(() => {});
      setConversations(prev => prev.map(c => c.phone === phone ? { ...c, unreadCount: 0 } : c));
    } catch {
      toast.error('Failed to load conversation');
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const loadContact = useCallback(async (phone: string) => {
    try {
      const { data } = await api.get(`/notifications/whatsapp/conversations/${phone}/contact`);
      setContact(data);
    } catch {
      setContact(null);
    }
  }, []);

  const loadNotes = useCallback(async (phone: string) => {
    setNotesLoading(true);
    try {
      const { data } = await api.get(`/notifications/whatsapp/conversations/${phone}/notes`);
      setNotes(Array.isArray(data) ? data : []);
    } catch {
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPhone) {
      loadThread(selectedPhone);
      loadContact(selectedPhone);
      loadNotes(selectedPhone);
      setEditingName(false);
      setContactTab('info');
    }
  }, [selectedPhone, loadThread, loadContact, loadNotes]);

  async function addNote() {
    if (!selectedPhone || !noteInput.trim()) return;
    setSavingNote(true);
    try {
      await api.post(`/notifications/whatsapp/conversations/${selectedPhone}/notes`, { body: noteInput.trim() });
      setNoteInput('');
      await loadNotes(selectedPhone);
    } catch {
      toast.error('Failed to save note');
    } finally {
      setSavingNote(false);
    }
  }

  async function saveName() {
    if (!selectedPhone || !nameInput.trim()) return;
    setSavingName(true);
    try {
      const { data } = await api.patch(`/notifications/whatsapp/conversations/${selectedPhone}/contact`, {
        name: nameInput.trim(),
      });
      setContact(data);
      setEditingName(false);
      loadConversations();
      toast.success('Contact saved');
    } catch {
      toast.error('Failed to save contact');
    } finally {
      setSavingName(false);
    }
  }

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useWebSocketEvent<WaMessageEvent>('wa.message.received', (data) => {
    loadConversations();
    if (selectedPhoneRef.current === data.phone) {
      loadThread(data.phone);
    } else {
      toast(`New message from +${data.phone}`, { icon: '💬' });
    }
  });

  useWebSocketEvent<WaMessageEvent>('wa.message.sent', (data) => {
    loadConversations();
    if (selectedPhoneRef.current === data.phone) {
      loadThread(data.phone);
    }
  });

  useWebSocketEvent<{ phone: string }>('wa.conversation.assigned', () => {
    loadConversations();
  });

  function startNewChat(rawPhone?: string) {
    const source = typeof rawPhone === 'string' ? rawPhone : newChatPhone;
    const digits = source.replace(/\D/g, '');
    const local = digits.length >= 10 ? digits.slice(-10) : digits;
    if (!/^[6-9]\d{9}$/.test(local)) { toast.error('Enter a valid 10-digit Indian mobile number'); return; }
    const e164 = `91${local}`;
    setShowNewChat(false);
    setNewChatPhone('');
    // Select immediately (same "91"-prefixed format every conversation in
    // this list already uses) so the existing wa.message.sent listener above
    // picks up the send once it actually lands from the template modal.
    setSelectedPhone(e164);
    setMobileView('thread');
    onStartNewChat?.(e164);
  }

  async function assignConversation(userId: string | null) {
    if (!selectedPhone) return;
    setShowAssignPopover(false);
    try {
      await api.patch(`/notifications/whatsapp/conversations/${selectedPhone}/meta`, { assignedToUserId: userId });
      await loadConversations();
    } catch {
      toast.error('Failed to update assignment');
    }
  }

  async function sendReply() {
    if (!selectedPhone || !replyText.trim()) return;
    const text = replyText.trim();
    // Optimistic: show the message immediately instead of waiting on the round
    // trip — loadThread() below (or the wa.message.sent WS event) replaces the
    // whole `messages` array with the server's real copy shortly after, which
    // naturally supersedes this temp entry. No dedup needed.
    const tempId = `temp-${Date.now()}`;
    setMessages(m => [...m, {
      id: tempId, waMessageId: tempId, direction: 'OUTBOUND', phone: selectedPhone,
      messageType: 'TEXT', templateName: null, bodyPreview: text, buttonId: null,
      mediaId: null, isAutoReply: false, status: 'QUEUED', errorMessage: null,
      createdAt: new Date().toISOString(),
    }]);
    setReplyText('');
    setSending(true);
    try {
      const { data } = await api.post(`/notifications/whatsapp/conversations/${selectedPhone}/reply`, { text });
      if (data?.ok) {
        await loadThread(selectedPhone);
      } else {
        setMessages(m => m.filter(msg => msg.id !== tempId));
        setReplyText(text);
        toast.error(data?.reason ?? 'Send failed — session window may be closed');
      }
    } catch (e: any) {
      setMessages(m => m.filter(msg => msg.id !== tempId));
      setReplyText(text);
      toast.error(e?.response?.data?.message ?? 'Send failed');
    } finally {
      setSending(false);
    }
  }

  async function sendMedia(file: File) {
    if (!selectedPhone) return;
    const isImage = file.type.startsWith('image/');
    const endpoint = isImage ? 'send-image' : 'send-document';
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`/notifications/whatsapp/conversations/${selectedPhone}/${endpoint}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data?.ok) {
        await loadThread(selectedPhone);
      } else {
        toast.error(data?.reason ?? 'Send failed — session window may be closed');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Send failed');
    } finally {
      setUploadingImage(false);
    }
  }

  async function openDocument(mediaId: string) {
    try {
      const res = await api.get(`/notifications/whatsapp/media/${mediaId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error('Could not open document');
    }
  }

  async function sendReaction(messageId: string, emoji: string) {
    if (!selectedPhone) return;
    try {
      const { data } = await api.post(`/notifications/whatsapp/conversations/${selectedPhone}/react`, { messageId, emoji });
      if (data?.ok) {
        await loadThread(selectedPhone);
      } else {
        toast.error(data?.reason ?? 'Reaction failed');
      }
    } catch {
      toast.error('Reaction failed');
    }
  }

  async function updateMeta(patch: Partial<{ status: 'OPEN' | 'RESOLVED'; pinned: boolean; labels: string[] }>) {
    if (!selectedPhone) return;
    setSavingMeta(true);
    try {
      await api.patch(`/notifications/whatsapp/conversations/${selectedPhone}/meta`, patch);
      await loadConversations();
    } catch {
      toast.error('Failed to update conversation');
    } finally {
      setSavingMeta(false);
    }
  }

  function addLabel() {
    const val = labelInput.trim();
    if (!val || !selectedConv) return;
    const labels = Array.from(new Set([...(selectedConv.labels ?? []), val]));
    updateMeta({ labels });
    setLabelInput('');
  }

  function removeLabel(label: string) {
    if (!selectedConv) return;
    updateMeta({ labels: (selectedConv.labels ?? []).filter(l => l !== label) });
  }

  // Slash-command filter: "/" alone shows everything, "/refund" filters by
  // title/body/category containing "refund".
  const cannedFilterText = replyText.startsWith('/') ? replyText.slice(1).toLowerCase() : null;
  const filteredCannedReplies = cannedFilterText === null ? [] : cannedReplies.filter(r =>
    r.title.toLowerCase().includes(cannedFilterText)
    || r.body.toLowerCase().includes(cannedFilterText)
    || (r.category ?? '').toLowerCase().includes(cannedFilterText)
  );

  function insertCannedReply(reply: CannedReply) {
    setReplyText(reply.body);
    setCannedIndex(0);
  }

  function toggleFilter(key: string, current: boolean, setter: (v: boolean) => void) {
    const next = !current;
    setter(next);
    params.set({ [key]: next ? '1' : null });
  }

  const filtered = conversations.filter(c => {
    if (unreadOnly && c.unreadCount === 0) return false;
    if (!showResolved && c.convStatus === 'RESOLVED') return false;
    if (assignedToMeOnly && c.assignedToUserId !== currentUserId) return false;
    if (waitingOnly && c.lastDirection !== 'OUTBOUND') return false;
    if (vipOnly && !(c.labels ?? []).some(l => l.toUpperCase() === 'VIP')) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const localMatch = c.phone.includes(q)
      || (c.customerName ?? '').toLowerCase().includes(q)
      || (c.labels ?? []).some(l => l.toLowerCase().includes(q));
    const msgMatch = msgSearchPhones?.has(c.phone) ?? false;
    return localMatch || msgMatch;
  });

  const selectedConv = conversations.find(c => c.phone === selectedPhone);

  // Power-user list navigation: Up/Down to move, Enter to open — skipped
  // whenever focus is inside an input/textarea/select/contentEditable (search
  // box, composer, canned-reply popover, name/label edit fields all already
  // handle their own Up/Down/Enter locally) so this never double-fires.
  useEffect(() => {
    function isTyping() {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (isTyping() || filtered.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => (i < filtered.length - 1 ? i + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => (i > 0 ? i - 1 : filtered.length - 1));
      } else if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < filtered.length) {
        e.preventDefault();
        const c = filtered[activeIndex];
        setSelectedPhone(c.phone);
        setMobileView('thread');
      } else if (e.key === 'Escape') {
        setActiveIndex(-1);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filtered, activeIndex]);

  return (
    <div className="space-y-3">
      {push.isSupported && push.permission === 'default' && !pushBannerDismissed && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 shadow-sm bg-green-50/60 px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Bell size={15} className="text-green-600 shrink-0" />
            <p className="text-xs text-gray-700 truncate">Get notified of new messages even when this tab is closed</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={enablePush} disabled={push.busy} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
              {push.busy ? 'Enabling…' : 'Enable'}
            </button>
            <button onClick={dismissPushBanner} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
          </div>
        </div>
      )}
    <div className="flex h-[calc(100dvh-200px)] min-h-[560px] border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* ── Pane 1: Conversation list ── */}
      <div className={`${mobileView === 'list' ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 xl:w-96 border-r border-gray-200 flex-col shrink-0`}>
        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-8 text-sm h-8 py-1"
                placeholder="Search name, number, or message"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowNewChat(v => !v)}
              title="Start a new chat with a number not in this list"
              className={`flex items-center justify-center w-8 h-8 rounded-lg border shrink-0 transition-colors ${
                showNewChat ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <MessageSquarePlus size={15} />
            </button>
            <SavedViews />
          </div>
          {showNewChat && (
            <div className="relative" ref={newChatContainerRef}>
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  className="input text-sm h-8 py-1 flex-1"
                  placeholder="Search contacts or type a number"
                  value={newChatPhone}
                  onChange={e => { setNewChatPhone(e.target.value); setNewChatOpen(true); setNewChatActiveIndex(-1); }}
                  onFocus={() => setNewChatOpen(true)}
                  onKeyDown={e => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setNewChatActiveIndex(i => (i < newChatRows.length - 1 ? i + 1 : 0)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setNewChatActiveIndex(i => (i > 0 ? i - 1 : newChatRows.length - 1)); }
                    else if (e.key === 'Enter') {
                      const row = newChatActiveIndex >= 0 ? newChatRows[newChatActiveIndex] : null;
                      if (row) selectNewChatRow(row); else startNewChat();
                    } else if (e.key === 'Escape') { setShowNewChat(false); setNewChatOpen(false); }
                  }}
                />
                <button onClick={() => startNewChat()} disabled={!newChatPhone.trim()} className="btn-primary text-xs px-2.5 py-1.5 disabled:opacity-50">
                  Start
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Search contacts, or type a full number to start a new chat</p>
              {newChatOpen && newChatRows.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                  {newChatRows.map((row, idx) => (
                    <button
                      key={row.kind === 'new' ? `new-${row.phone}` : row.contact.id}
                      onClick={() => selectNewChatRow(row)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${idx === newChatActiveIndex ? 'bg-gray-50' : ''} ${idx !== newChatRows.length - 1 ? 'border-b border-gray-100' : ''}`}
                    >
                      {row.kind === 'contact' ? (
                        <>
                          <span className="min-w-0">
                            <span className="block font-medium text-gray-800 truncate">{row.contact.name}</span>
                            <span className="block text-xs text-gray-500">+91 {row.contact.phone}</span>
                          </span>
                          {row.contact.hasConversation && (
                            <span className="shrink-0 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                              Already chatting
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="flex items-center gap-1.5 text-green-700">
                          <MessageSquarePlus size={13} />
                          Start new chat with +91 {row.phone}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => toggleFilter('unread', unreadOnly, setUnreadOnly)}
              className={`text-[11px] font-medium rounded-full px-2 py-1 border transition-colors ${
                unreadOnly ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => toggleFilter('resolved', showResolved, setShowResolved)}
              className={`text-[11px] font-medium rounded-full px-2 py-1 border transition-colors ${
                showResolved ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
              title="Include resolved conversations in the list"
            >
              Resolved
            </button>
            {currentUserId && (
              <button
                onClick={() => toggleFilter('mine', assignedToMeOnly, setAssignedToMeOnly)}
                className={`text-[11px] font-medium rounded-full px-2 py-1 border transition-colors ${
                  assignedToMeOnly ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
                title="Only show conversations assigned to me"
              >
                Assigned to me
              </button>
            )}
            <button
              onClick={() => toggleFilter('waiting', waitingOnly, setWaitingOnly)}
              className={`text-[11px] font-medium rounded-full px-2 py-1 border transition-colors ${
                waitingOnly ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
              title="Conversations where we sent the last message and the customer hasn't replied yet"
            >
              Waiting for reply
            </button>
            <button
              onClick={() => toggleFilter('vip', vipOnly, setVipOnly)}
              className={`text-[11px] font-medium rounded-full px-2 py-1 border transition-colors ${
                vipOnly ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
              title={'Only show conversations labeled "VIP" — add the label from the contact panel'}
            >
              VIP
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convLoading ? (
            <div>{Array.from({ length: 6 }).map((_, i) => <ConversationRowSkeleton key={i} />)}</div>
          ) : filtered.length === 0 && addressBookMatches.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <MessageSquare size={28} className="mx-auto mb-2.5 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">
                {search || unreadOnly || assignedToMeOnly || waitingOnly || vipOnly ? 'No conversations match your filters' : 'No conversations yet'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {search || unreadOnly || assignedToMeOnly || waitingOnly || vipOnly ? 'Try clearing a filter or searching something else' : 'New chats will show up here'}
              </p>
            </div>
          ) : (
            filtered.map((c, idx) => (
              <button
                key={c.phone}
                onClick={() => { setSelectedPhone(c.phone); setMobileView('thread'); setActiveIndex(idx); }}
                className={`w-full text-left px-3.5 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedPhone === c.phone ? 'bg-green-50' : ''} ${activeIndex === idx ? 'ring-2 ring-inset ring-green-400' : ''} ${c.convStatus === 'RESOLVED' ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar seed={c.customerName ?? c.phone} />
                    <div className="min-w-0">
                      <p className={`text-sm truncate flex items-center gap-1 ${c.unreadCount > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'}`}>
                        {c.pinned && <Pin size={10} className="text-amber-500 shrink-0" fill="currentColor" />}
                        <span className="truncate">{c.customerName ?? `+${c.phone}`}</span>
                      </p>
                      <p className={`text-xs truncate ${c.unreadCount > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                        {c.lastDirection === 'OUTBOUND' ? 'You: ' : ''}{c.lastMessage ?? `[${c.lastMessageType}]`}
                      </p>
                      {(c.outstandingDue || (c.labels?.length ?? 0) > 0) && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {c.outstandingDue && (
                            <span
                              title="Outstanding balance owed by this customer"
                              className="text-[9px] font-semibold bg-red-50 text-red-600 border border-red-200 rounded-full px-1.5 py-0.5">
                              Due ₹{Math.round(c.outstandingDue).toLocaleString('en-IN')}
                            </span>
                          )}
                          {(c.labels ?? []).slice(0, 2).map(l => (
                            <span key={l} className="text-[9px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-1.5 py-0.5">
                              {l}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-gray-400">{fmtRelative(c.lastAt)}</span>
                    {c.unreadCount > 0 && (
                      <span className="text-[10px] font-bold bg-green-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                        {c.unreadCount}
                      </span>
                    )}
                    {c.convStatus === 'RESOLVED' && (
                      <span title="Resolved"><CheckCircle2 size={12} className="text-gray-400" /></span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
          {addressBookMatches.length > 0 && (
            <div>
              <p className="px-3.5 pt-3 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                In your address book — no chat yet
              </p>
              {addressBookMatches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => startNewChat(m.phone)}
                  className="w-full text-left px-3.5 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center gap-2.5"
                >
                  <Avatar seed={m.name || m.phone} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.name || `+91${m.phone}`}</p>
                    <p className="text-xs text-gray-400 truncate">+91{m.phone}</p>
                  </div>
                  <MessageSquarePlus size={13} className="text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Pane 2: Thread — full-viewport takeover below `lg`, in-flow pane at `lg`+ ── */}
      <div className={`${mobileView === 'thread' ? 'flex' : 'hidden'} lg:flex fixed inset-0 z-40 bg-white lg:static lg:inset-auto lg:z-auto flex-col lg:flex-1 min-w-0 lg:border-r lg:border-gray-200`}>
        {!selectedPhone ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare size={36} className="mb-2 text-gray-300" />
            <p className="text-sm">Select a conversation to view messages</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-gray-100 shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setMobileView('list')}
                  className="lg:hidden -ml-1 p-1 text-gray-500 hover:text-gray-700 shrink-0"
                  title="Back to conversations"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setMobileView('contact')}
                  className="lg:hidden flex items-center gap-2 min-w-0 text-left"
                  title="View contact info"
                >
                  <Avatar seed={contact?.name ?? selectedConv?.customerName ?? selectedPhone ?? '?'} size="sm" />
                  <span className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {contact?.name ?? selectedConv?.customerName ?? `+${selectedPhone}`}
                    </p>
                    <p className="text-xs text-gray-500">+{selectedPhone}</p>
                  </span>
                </button>
                <div className="hidden lg:block min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {contact?.name ?? selectedConv?.customerName ?? `+${selectedPhone}`}
                  </p>
                  <p className="text-xs text-gray-500">+{selectedPhone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowAssignPopover(v => !v)}
                  title={selectedConv?.assignedToName ? `Assigned to ${selectedConv.assignedToName}` : 'Assign to a staff member'}
                  className={`text-[10px] font-medium rounded-full px-2 py-1 border flex items-center gap-1 transition-colors ${
                    selectedConv?.assignedToUserId ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <UserCircle2 size={11} />
                  {selectedConv?.assignedToName ?? 'Assign'}
                </button>
                {showAssignPopover && (
                  <div className="absolute top-full right-0 mt-1 w-48 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-20">
                    {selectedConv?.assignedToUserId && (
                      <button
                        onClick={() => assignConversation(null)}
                        className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 border-b border-gray-50"
                      >
                        Unassign
                      </button>
                    )}
                    {staffList.map(s => (
                      <button
                        key={s.id}
                        onClick={() => assignConversation(s.id)}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${s.id === selectedConv?.assignedToUserId ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}
                      >
                        {s.fullName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {sessionOpen === false ? (
                <span
                  title="Meta only allows free-text replies within 24h of the customer's last message. Outside that window, only pre-approved templates can be sent — use the Templates tab."
                  className="cursor-help text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-1 flex items-center gap-1 shrink-0">
                  <Clock size={10} /> Session closed
                </span>
              ) : sessionOpen === true && windowExpiresAt ? (
                <span
                  title={`Free-text replies allowed until ${new Date(windowExpiresAt).toLocaleString('en-IN')}`}
                  className="cursor-help text-[10px] font-medium bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-1 flex items-center gap-1 shrink-0">
                  <Clock size={10} /> Session open
                </span>
              ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#e5ded8]/40">
              {threadLoading ? (
                <div className="space-y-2"><ThreadSkeleton /></div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-10">
                  <p>No messages yet</p>
                  {sessionOpen === false && (
                    <>
                      <p className="text-xs mt-1 max-w-xs mx-auto">This number hasn't messaged you, so Meta requires an approved template to start the conversation.</p>
                      <button
                        onClick={() => onStartNewChat?.(selectedPhone!, contact?.name ?? selectedConv?.customerName ?? undefined)}
                        className="btn-primary text-xs px-3 py-1.5 mt-3 inline-flex items-center gap-1.5"
                      >
                        <MessageSquarePlus size={13} /> Send a Template
                      </button>
                    </>
                  )}
                </div>
              ) : (
                messages.map(m => {
                  const [lat, lng] = m.messageType === 'LOCATION' && m.bodyPreview ? m.bodyPreview.split(',') : [null, null];
                  return (
                  <div key={m.id} className={`group flex items-center gap-1.5 ${m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                    {m.direction === 'OUTBOUND' && (
                      <button
                        onClick={() => setReactingTo(r => r === m.id ? null : m.id)}
                        disabled={!sessionOpen}
                        title="React"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 disabled:opacity-0 shrink-0"
                      >
                        <SmilePlus size={14} />
                      </button>
                    )}
                    <div className="relative">
                      {reactingTo === m.id && (
                        <div className="absolute -top-9 right-0 bg-white border border-gray-200 rounded-full shadow-md px-1.5 py-1 flex gap-1 z-10">
                          {QUICK_REACTIONS.map(emoji => (
                            <button key={emoji}
                              onClick={() => { sendReaction(m.waMessageId, emoji); setReactingTo(null); }}
                              className="text-base hover:scale-125 transition-transform">
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        m.direction === 'OUTBOUND'
                          ? 'bg-[#dcf8c6] text-gray-900 rounded-br-sm'
                          : 'bg-white text-gray-900 rounded-bl-sm border border-gray-100'
                      }`}>
                        {(m.templateName || m.isAutoReply) && (
                          <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5 flex items-center gap-1">
                            {m.templateName}
                            {m.isAutoReply && (
                              <span title="Sent automatically by the rule-based auto-reply, not a staff member" className="cursor-help inline-flex items-center gap-0.5 text-indigo-600 normal-case font-medium">
                                <Bot size={10} /> Auto
                              </span>
                            )}
                          </p>
                        )}
                        {m.messageType === 'IMAGE' && m.mediaId ? (
                          <ChatImage mediaId={m.mediaId} />
                        ) : m.messageType === 'DOCUMENT' && m.mediaId ? (
                          <button
                            onClick={() => openDocument(m.mediaId!)}
                            className="flex items-center gap-2 text-blue-700 hover:underline text-left">
                            <FileText size={16} className="shrink-0" />
                            <span className="truncate">{m.bodyPreview?.replace('[Document] ', '') || 'Document'}</span>
                          </button>
                        ) : m.messageType === 'LOCATION' && lat && lng ? (
                          <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-blue-700 hover:underline">
                            <MapPin size={16} className="shrink-0" />
                            <span>View location on map</span>
                          </a>
                        ) : m.messageType === 'REACTION' ? (
                          <p className="text-lg">{m.bodyPreview}</p>
                        ) : (
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{m.bodyPreview || `[${m.messageType}]`}</p>
                        )}
                        {m.errorMessage && (
                          <p className="text-[10px] text-red-500 mt-1">{m.errorMessage}</p>
                        )}
                        <p className="text-[10px] text-gray-400 text-right mt-1 flex items-center justify-end gap-1">
                          {fmtTime(m.createdAt)}
                          {m.direction === 'OUTBOUND' && <StatusTick status={m.status} />}
                        </p>
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
              <div ref={threadEndRef} />
            </div>

            {sessionOpen === false && messages.length > 0 ? (
              <div className="p-3 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0 bg-amber-50">
                <p className="text-xs text-amber-700 flex items-center gap-1.5">
                  <Clock size={12} className="shrink-0" />
                  Session closed — the customer hasn't messaged in 24h. Send an approved template to reopen the conversation.
                </p>
                <button
                  onClick={() => onStartNewChat?.(selectedPhone!, contact?.name ?? selectedConv?.customerName ?? undefined)}
                  className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1.5 shrink-0"
                >
                  <MessageSquarePlus size={13} /> Send a Template
                </button>
              </div>
            ) : (
            <div className="relative p-3 border-t border-gray-100 flex gap-2 shrink-0">
              {cannedFilterText !== null && filteredCannedReplies.length > 0 && (
                <div className="absolute bottom-full left-3 right-3 mb-1 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-2xl shadow-lg z-10">
                  {filteredCannedReplies.map((r, idx) => (
                    <button
                      key={r.id}
                      onClick={() => insertCannedReply(r)}
                      onMouseEnter={() => setCannedIndex(idx)}
                      className={`w-full text-left px-3 py-2 border-b border-gray-50 last:border-0 ${idx === cannedIndex ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                    >
                      <p className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                        <Zap size={11} className="text-green-600 shrink-0" /> {r.title}
                        {r.category && <span className="text-[9px] font-normal text-gray-400">· {r.category}</span>}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{r.body}</p>
                    </button>
                  ))}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) sendMedia(file);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage || !sessionOpen}
                title={sessionOpen ? 'Send an image or document' : 'Reply unavailable — session closed'}
                className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 shrink-0"
              >
                <Paperclip size={15} />
              </button>
              <button
                onClick={() => { setReplyText('/'); setCannedIndex(0); }}
                disabled={!sessionOpen || cannedReplies.length === 0}
                title="Insert a quick reply"
                className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 shrink-0"
              >
                <Zap size={15} />
              </button>
              <input
                className="input flex-1 text-sm"
                placeholder={sessionOpen ? 'Type a message… (try / for quick replies)' : 'Reply unavailable — session closed, use a template'}
                value={replyText}
                onChange={e => { setReplyText(e.target.value); setCannedIndex(0); }}
                onFocus={() => { if (selectedPhone) api.post(`/notifications/whatsapp/conversations/${selectedPhone}/typing`).catch(() => {}); }}
                onKeyDown={e => {
                  if (cannedFilterText !== null && filteredCannedReplies.length > 0) {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setCannedIndex(i => (i + 1) % filteredCannedReplies.length); return; }
                    if (e.key === 'ArrowUp')   { e.preventDefault(); setCannedIndex(i => (i - 1 + filteredCannedReplies.length) % filteredCannedReplies.length); return; }
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const pick = filteredCannedReplies[cannedIndex] ?? filteredCannedReplies[0];
                      insertCannedReply(pick);
                      return;
                    }
                    if (e.key === 'Escape')    { e.preventDefault(); setReplyText(''); return; }
                  }
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
                }}
                disabled={!sessionOpen}
              />
              <button
                onClick={sendReply}
                disabled={sending || !sessionOpen || !replyText.trim()}
                className="btn-primary flex items-center gap-1.5 text-sm px-4 disabled:opacity-50"
              >
                <Send size={14} /> Send
              </button>
            </div>
            )}
          </>
        )}
      </div>

      {/* ── Pane 3: Persistent contact panel — full-viewport takeover below `lg` ── */}
      {selectedPhone && (
        <div className={`${mobileView === 'contact' ? 'flex' : 'hidden'} lg:flex fixed inset-0 z-40 bg-white lg:static lg:inset-auto lg:z-auto lg:w-80 xl:w-96 shrink-0 flex-col overflow-y-auto p-4 gap-5 bg-gray-50/60`}>
          <button
            onClick={() => setMobileView('thread')}
            className="lg:hidden flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 -mt-1 -ml-1"
          >
            <ChevronLeft size={15} /> Back
          </button>

          {/* Info / Notes tab switch */}
          <div className="flex items-center gap-3 border-b border-gray-200 -mt-1">
            <button
              onClick={() => setContactTab('info')}
              className={`text-xs font-medium pb-1.5 border-b-2 -mb-px transition-colors ${
                contactTab === 'info' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Info
            </button>
            <button
              onClick={() => setContactTab('notes')}
              className={`flex items-center gap-1 text-xs font-medium pb-1.5 border-b-2 -mb-px transition-colors ${
                contactTab === 'notes' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Notes {notes.length > 0 && <span className="text-[10px] bg-gray-200 text-gray-600 rounded-full px-1.5">{notes.length}</span>}
            </button>
          </div>

          {contactTab === 'notes' ? (
            <div className="flex flex-col gap-3">
              <div className="space-y-1.5">
                <textarea
                  className="input text-xs w-full resize-none"
                  rows={3}
                  placeholder="Add a note for the team — not visible to the customer"
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                />
                <button
                  onClick={addNote}
                  disabled={savingNote || !noteInput.trim()}
                  className="btn-primary text-xs px-3 py-1 disabled:opacity-50 w-full"
                >
                  Add note
                </button>
              </div>
              {notesLoading ? (
                <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
              ) : notes.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No internal notes yet</p>
              ) : (
                <div className="space-y-2">
                  {notes.map(n => (
                    <div key={n.id} className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                      <p className="flex items-center gap-1 text-[10px] font-medium text-amber-700 mb-1">
                        <StickyNote size={10} /> Internal note — not sent to customer
                      </p>
                      <p className="text-xs text-gray-800 whitespace-pre-wrap break-words">{n.body}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{n.authorName} · {fmtRelative(n.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
          <>
          {/* Identity */}
          <div>
            <div className="mb-2">
              <Avatar seed={contact?.name ?? selectedConv?.customerName ?? selectedPhone ?? '?'} size="lg" />
            </div>
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  className="input text-sm h-7 py-0 flex-1"
                  placeholder="Customer name"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                />
                <button onClick={saveName} disabled={savingName || !nameInput.trim()} className="btn-primary text-xs px-2 py-1 disabled:opacity-50">Save</button>
              </div>
            ) : (
              <button
                onClick={() => { setNameInput(contact?.name ?? ''); setEditingName(true); }}
                className="flex items-center gap-1.5 group"
                title="Click to name this contact"
              >
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {contact?.name ?? selectedConv?.customerName ?? `+${selectedPhone}`}
                </p>
                <Pencil size={11} className="text-gray-300 group-hover:text-gray-500 shrink-0" />
              </button>
            )}
            <p className="text-xs text-gray-500 mt-0.5">+{selectedPhone}</p>
            {contact?.customerId ? (
              <Link href={`/dashboard/customers/${contact.customerId}`} target="_blank"
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline mt-1.5">
                <ExternalLink size={10} /> View full profile
              </Link>
            ) : (
              <span className="inline-block text-[10px] text-gray-400 bg-gray-100 border border-gray-200 rounded-full px-1.5 py-0.5 mt-1.5">New contact</span>
            )}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateMeta({ pinned: !selectedConv?.pinned })}
              disabled={savingMeta}
              className={`flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg px-2 py-1.5 border transition-colors disabled:opacity-50 ${
                selectedConv?.pinned ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {selectedConv?.pinned ? <PinOff size={13} /> : <Pin size={13} />}
              {selectedConv?.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              onClick={() => updateMeta({ status: selectedConv?.convStatus === 'RESOLVED' ? 'OPEN' : 'RESOLVED' })}
              disabled={savingMeta}
              className={`flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg px-2 py-1.5 border transition-colors disabled:opacity-50 ${
                selectedConv?.convStatus === 'RESOLVED' ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {selectedConv?.convStatus === 'RESOLVED' ? <Circle size={13} /> : <CheckCircle2 size={13} />}
              {selectedConv?.convStatus === 'RESOLVED' ? 'Reopen' : 'Resolve'}
            </button>
          </div>

          {/* Labels */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Tag size={11} /> Labels
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(selectedConv?.labels ?? []).map(l => (
                <span key={l} className="inline-flex items-center gap-1 text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full pl-2 pr-1 py-0.5">
                  {l}
                  <button onClick={() => removeLabel(l)} className="hover:text-indigo-900">
                    <X size={10} />
                  </button>
                </span>
              ))}
              {(selectedConv?.labels?.length ?? 0) === 0 && (
                <span className="text-[11px] text-gray-400">No labels yet</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <input
                className="input text-xs h-7 py-0 flex-1"
                placeholder="Add a label…"
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addLabel(); }}
              />
              <button onClick={addLabel} disabled={!labelInput.trim() || savingMeta} className="btn-outline text-xs px-2 py-1 disabled:opacity-40">
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* ERP snapshot */}
          {contact && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">ERP snapshot</p>
              <div className="space-y-1.5">
                {contact.orderCount > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <ShoppingBag size={12} className="text-gray-400 shrink-0" />
                    {contact.orderCount} online order{contact.orderCount > 1 ? 's' : ''}
                    {contact.lastOrder && ` · last ₹${Number(contact.lastOrder.total).toFixed(0)} (${contact.lastOrder.status})`}
                  </div>
                )}
                {contact.posBillCount > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Receipt size={12} className="text-gray-400 shrink-0" />
                    {contact.posBillCount} in-store bill{contact.posBillCount > 1 ? 's' : ''}
                    {contact.lastPosBill && ` · last ₹${Number(contact.lastPosBill.grandTotal).toFixed(0)}`}
                  </div>
                )}
                {contact.loyaltyPoints !== null && contact.loyaltyPoints > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600">
                    <Award size={12} className="shrink-0" /> {contact.loyaltyPoints} loyalty points
                  </div>
                )}
                {contact.outstandingBalance !== null && Number(contact.outstandingBalance) > 0 && (
                  <div
                    title={contact.creditLimit ? `Credit limit ₹${Number(contact.creditLimit).toFixed(0)}` : undefined}
                    className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1 cursor-help">
                    <AlertCircle size={12} className="shrink-0" /> ₹{Number(contact.outstandingBalance).toFixed(0)} due
                  </div>
                )}
                {contact.orderCount === 0 && contact.posBillCount === 0 && (
                  <p className="text-xs text-gray-400">No purchase history yet</p>
                )}
              </div>
            </div>
          )}
          </>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
