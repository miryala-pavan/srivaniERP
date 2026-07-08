'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Send, Search, Clock, MessageSquare, Paperclip, Bot,
  Check, CheckCheck, AlertCircle, Pencil, ExternalLink, ShoppingBag, Award, Receipt,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';

interface Conversation {
  phone: string;
  customerName: string | null;
  lastMessage: string | null;
  lastMessageType: string;
  lastDirection: 'OUTBOUND' | 'INBOUND';
  lastAt: string;
  lastStatus: string;
  unreadCount: number;
}

interface ThreadMessage {
  id: string;
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

interface WaMessageEvent {
  phone: string;
  direction: 'OUTBOUND' | 'INBOUND';
  bodyPreview: string | null;
  messageType: string;
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

export default function WhatsAppChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading]     = useState(true);
  const [search, setSearch]               = useState('');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  const [messages, setMessages]         = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sessionOpen, setSessionOpen]   = useState<boolean | null>(null);
  const [windowExpiresAt, setWindowExpiresAt] = useState<string | null>(null);
  const [replyText, setReplyText]       = useState('');
  const [sending, setSending]           = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [contact, setContact]           = useState<ContactInfo | null>(null);
  const [editingName, setEditingName]   = useState(false);
  const [nameInput, setNameInput]       = useState('');
  const [savingName, setSavingName]     = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const selectedPhoneRef = useRef<string | null>(null);
  selectedPhoneRef.current = selectedPhone;

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

  useEffect(() => {
    if (selectedPhone) { loadThread(selectedPhone); loadContact(selectedPhone); setEditingName(false); }
  }, [selectedPhone, loadThread, loadContact]);

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

  async function sendReply() {
    if (!selectedPhone || !replyText.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post(`/notifications/whatsapp/conversations/${selectedPhone}/reply`, {
        text: replyText.trim(),
      });
      if (data?.ok) {
        setReplyText('');
        await loadThread(selectedPhone);
      } else {
        toast.error(data?.reason ?? 'Send failed — session window may be closed');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Send failed');
    } finally {
      setSending(false);
    }
  }

  async function sendImage(file: File) {
    if (!selectedPhone) return;
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`/notifications/whatsapp/conversations/${selectedPhone}/send-image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data?.ok) {
        await loadThread(selectedPhone);
      } else {
        toast.error(data?.reason ?? 'Image send failed — session window may be closed');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Image send failed');
    } finally {
      setUploadingImage(false);
    }
  }

  const filtered = conversations.filter(c => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return c.phone.includes(q) || (c.customerName ?? '').toLowerCase().includes(q);
  });

  const selectedConv = conversations.find(c => c.phone === selectedPhone);

  return (
    <div className="flex h-[calc(100vh-260px)] min-h-[480px] border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* ── Conversation list ── */}
      <div className="w-72 sm:w-80 border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-8 text-sm h-8 py-1"
              placeholder="Search name or number"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convLoading ? (
            <div className="p-4 text-center text-gray-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <MessageSquare size={26} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            filtered.map(c => (
              <button
                key={c.phone}
                onClick={() => setSelectedPhone(c.phone)}
                className={`w-full text-left px-3.5 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedPhone === c.phone ? 'bg-green-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                      {(c.customerName ?? c.phone).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.customerName ?? `+${c.phone}`}</p>
                      <p className={`text-xs truncate ${c.unreadCount > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                        {c.lastDirection === 'OUTBOUND' ? 'You: ' : ''}{c.lastMessage ?? `[${c.lastMessageType}]`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-gray-400">{fmtRelative(c.lastAt)}</span>
                    {c.unreadCount > 0 && (
                      <span className="text-[10px] font-bold bg-green-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Thread ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedPhone ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare size={36} className="mb-2 text-gray-300" />
            <p className="text-sm">Select a conversation to view messages</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
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
                      <button onClick={() => setEditingName(false)} className="btn-outline text-xs px-2 py-1">Cancel</button>
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
                  <p className="text-xs text-gray-500">+{selectedPhone}</p>
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
              {contact && !editingName && (
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {contact.customerId ? (
                    <Link href={`/dashboard/customers/${contact.customerId}`} target="_blank"
                      className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
                      <ExternalLink size={10} /> View profile
                    </Link>
                  ) : (
                    <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-1.5 py-0.5">New contact</span>
                  )}
                  {contact.orderCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                      <ShoppingBag size={10} />
                      {contact.orderCount} online order{contact.orderCount > 1 ? 's' : ''}
                      {contact.lastOrder && ` · last ₹${Number(contact.lastOrder.total).toFixed(0)} (${contact.lastOrder.status})`}
                    </span>
                  )}
                  {contact.posBillCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                      <Receipt size={10} />
                      {contact.posBillCount} in-store bill{contact.posBillCount > 1 ? 's' : ''}
                      {contact.lastPosBill && ` · last ₹${Number(contact.lastPosBill.grandTotal).toFixed(0)}`}
                    </span>
                  )}
                  {contact.loyaltyPoints !== null && contact.loyaltyPoints > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
                      <Award size={10} /> {contact.loyaltyPoints} pts
                    </span>
                  )}
                  {contact.outstandingBalance !== null && Number(contact.outstandingBalance) > 0 && (
                    <span
                      title={contact.creditLimit ? `Credit limit ₹${Number(contact.creditLimit).toFixed(0)}` : undefined}
                      className="inline-flex items-center gap-1 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
                      <AlertCircle size={10} /> ₹{Number(contact.outstandingBalance).toFixed(0)} due
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#e5ded8]/40">
              {threadLoading ? (
                <div className="text-center text-gray-400 text-sm py-10">Loading…</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-10">No messages yet</div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className={`flex ${m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
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
                ))
              )}
              <div ref={threadEndRef} />
            </div>

            <div className="p-3 border-t border-gray-100 flex gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) sendImage(file);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage || !sessionOpen}
                title={sessionOpen ? 'Send an image' : 'Reply unavailable — session closed'}
                className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 shrink-0"
              >
                <Paperclip size={15} />
              </button>
              <input
                className="input flex-1 text-sm"
                placeholder={sessionOpen ? 'Type a message…' : 'Reply unavailable — session closed, use a template'}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
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
          </>
        )}
      </div>
    </div>
  );
}
