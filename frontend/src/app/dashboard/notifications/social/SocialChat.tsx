'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Globe, Camera, MessageSquare, Star, Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { Avatar } from '@/components/shared/Avatar';

type Channel = 'FACEBOOK' | 'INSTAGRAM';

interface Conversation {
  channel: Channel;
  externalUserId: string;
  lastMessage: string | null;
  lastMessageType: string;
  lastDirection: 'OUTBOUND' | 'INBOUND';
  lastAt: string;
  unreadCount: number;
}

interface ThreadMessage {
  id: string;
  direction: 'OUTBOUND' | 'INBOUND';
  messageType: string;
  bodyPreview: string | null;
  status: string;
  createdAt: string;
}

function StatusTick({ status }: { status: string }) {
  if (status === 'FAILED') return <AlertCircle size={12} className="text-red-400" />;
  if (status === 'READ') return <CheckCheck size={13} className="text-blue-500" />;
  if (status === 'DELIVERED') return <CheckCheck size={13} className="text-gray-400" />;
  if (status === 'SENT') return <Check size={13} className="text-gray-400" />;
  return <Clock size={11} className="text-gray-300" />;
}

function fmtRelative(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function SocialChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [selected, setSelected] = useState<{ channel: Channel; externalUserId: string } | null>(null);

  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [askingRecommend, setAskingRecommend] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/social/conversations');
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load conversations');
    } finally {
      setConvLoading(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useWebSocketEvent('social.message.received', () => loadConversations());
  useWebSocketEvent('social.message.sent',     () => loadConversations());

  const loadThread = useCallback(async (channel: Channel, externalUserId: string) => {
    setThreadLoading(true);
    try {
      const { data } = await api.get(`/notifications/social/conversations/${channel}/${externalUserId}/messages`);
      setMessages(Array.isArray(data) ? data : []);
      api.patch(`/notifications/social/conversations/${channel}/${externalUserId}/read`).catch(() => {});
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) loadThread(selected.channel, selected.externalUserId);
  }, [selected, loadThread]);

  useEffect(() => { threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function sendReply() {
    if (!selected || !replyText.trim()) return;
    const text = replyText.trim();
    setReplyText('');
    setSending(true);
    try {
      const { data } = await api.post(`/notifications/social/conversations/${selected.channel}/${selected.externalUserId}/reply`, { text });
      if (data?.ok === false) {
        toast.error('Send failed — Facebook/Instagram may not be connected yet');
        setReplyText(text);
      } else {
        await loadThread(selected.channel, selected.externalUserId);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Send failed');
      setReplyText(text);
    } finally {
      setSending(false);
    }
  }

  async function askForRecommendation() {
    if (!selected) return;
    setAskingRecommend(true);
    try {
      const { data } = await api.post(`/notifications/social/conversations/${selected.channel}/${selected.externalUserId}/recommend`);
      if (data?.ok === false) {
        toast.error('Send failed — Facebook/Instagram may not be connected yet');
      } else {
        toast.success('Recommendation request sent');
        await loadThread(selected.channel, selected.externalUserId);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to send');
    } finally {
      setAskingRecommend(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-260px)] min-h-[520px] border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Conversation list */}
      <div className="w-full lg:w-80 border-r border-gray-200 flex flex-col shrink-0">
        <div className="flex-1 overflow-y-auto">
          {convLoading ? (
            <div className="p-4 text-center text-gray-400 text-sm">Loading…</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <MessageSquare size={26} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs text-gray-400 mt-1">DMs from Facebook and Instagram will show up here</p>
            </div>
          ) : (
            conversations.map(c => (
              <button
                key={`${c.channel}:${c.externalUserId}`}
                onClick={() => setSelected({ channel: c.channel, externalUserId: c.externalUserId })}
                className={`w-full text-left px-3.5 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  selected?.channel === c.channel && selected?.externalUserId === c.externalUserId ? 'bg-pink-50' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar seed={c.externalUserId} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                        {c.channel === 'FACEBOOK' ? <Globe size={11} className="text-blue-600 shrink-0" /> : <Camera size={11} className="text-pink-600 shrink-0" />}
                        <span className="truncate">{c.externalUserId}</span>
                      </p>
                      <p className={`text-xs truncate ${c.unreadCount > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                        {c.lastDirection === 'OUTBOUND' ? 'You: ' : ''}{c.lastMessage ?? `[${c.lastMessageType}]`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-gray-400">{fmtRelative(c.lastAt)}</span>
                    {c.unreadCount > 0 && (
                      <span className="text-[10px] font-bold bg-pink-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
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

      {/* Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare size={36} className="mb-2 text-gray-300" />
            <p className="text-sm">Select a conversation to view messages</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-gray-100 shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar seed={selected.externalUserId} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1.5">
                    {selected.channel === 'FACEBOOK' ? <Globe size={12} className="text-blue-600" /> : <Camera size={12} className="text-pink-600" />}
                    {selected.externalUserId}
                  </p>
                </div>
              </div>
              <button
                onClick={askForRecommendation}
                disabled={askingRecommend}
                title="Send a request asking this customer for a Facebook recommendation"
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 shrink-0"
              >
                <Star size={12} /> {askingRecommend ? 'Sending…' : 'Ask for a recommendation'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/60">
              {threadLoading ? (
                <div className="text-center text-gray-400 text-sm py-10">Loading…</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-10">No messages yet</div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className={`flex ${m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      m.direction === 'OUTBOUND'
                        ? 'bg-pink-100 text-gray-900 rounded-br-sm'
                        : 'bg-white text-gray-900 rounded-bl-sm border border-gray-100'
                    }`}>
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{m.bodyPreview || `[${m.messageType}]`}</p>
                      <div className="text-[10px] text-gray-400 mt-1 text-right flex items-center justify-end gap-1">
                        {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        {m.direction === 'OUTBOUND' && <StatusTick status={m.status} />}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={threadEndRef} />
            </div>

            <div className="p-3 border-t border-gray-100 flex items-center gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="Type a message…"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
              />
              <button
                onClick={sendReply}
                disabled={sending || !replyText.trim()}
                className="p-2.5 rounded-lg bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
