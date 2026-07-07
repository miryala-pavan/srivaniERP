'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Search, Clock, MessageSquare } from 'lucide-react';
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
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface WaMessageEvent {
  phone: string;
  direction: 'OUTBOUND' | 'INBOUND';
  bodyPreview: string | null;
  messageType: string;
  createdAt: string;
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

  const threadEndRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (selectedPhone) loadThread(selectedPhone);
  }, [selectedPhone, loadThread]);

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
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <p className="text-sm font-semibold text-gray-900">{selectedConv?.customerName ?? `+${selectedPhone}`}</p>
                <p className="text-xs text-gray-500">+{selectedPhone}</p>
              </div>
              {sessionOpen === false ? (
                <span
                  title="Meta only allows free-text replies within 24h of the customer's last message. Outside that window, only pre-approved templates can be sent — use the Templates tab."
                  className="cursor-help text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-1 flex items-center gap-1">
                  <Clock size={10} /> Session closed
                </span>
              ) : sessionOpen === true && windowExpiresAt ? (
                <span
                  title={`Free-text replies allowed until ${new Date(windowExpiresAt).toLocaleString('en-IN')}`}
                  className="cursor-help text-[10px] font-medium bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-1 flex items-center gap-1">
                  <Clock size={10} /> Session open
                </span>
              ) : null}
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
                      {m.templateName && (
                        <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">{m.templateName}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{m.bodyPreview || `[${m.messageType}]`}</p>
                      {m.errorMessage && (
                        <p className="text-[10px] text-red-500 mt-1">{m.errorMessage}</p>
                      )}
                      <p className="text-[10px] text-gray-400 text-right mt-1">{fmtTime(m.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={threadEndRef} />
            </div>

            <div className="p-3 border-t border-gray-100 flex gap-2 shrink-0">
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
