'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Filter } from 'lucide-react';
import Header from '@/components/layout/Header';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { useWebSocket } from '@/providers/WebSocketProvider';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
}

function priorityBadge(priority: string, type: string) {
  const map: Record<string, string> = {
    URGENT: 'bg-red-100 text-red-700',
    HIGH:   'bg-orange-100 text-orange-700',
    NORMAL: 'bg-yellow-100 text-yellow-700',
    LOW:    'bg-blue-100 text-blue-600',
  };
  const dotMap: Record<string, string> = {
    URGENT: 'bg-red-500',
    HIGH:   'bg-orange-400',
    NORMAL: 'bg-yellow-400',
    LOW:    'bg-blue-400',
  };
  if (type === 'OUT_OF_STOCK') return { cls: map.URGENT,  dot: dotMap.URGENT };
  if (type === 'LOW_STOCK' || type === 'GRN_PENDING') return { cls: map.HIGH,   dot: dotMap.HIGH };
  if (type === 'RESTOCKED' || type === 'GRN_APPROVED') return { cls: map.NORMAL, dot: dotMap.NORMAL };
  return { cls: map[priority] ?? map.LOW, dot: dotMap[priority] ?? dotMap.LOW };
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    OUT_OF_STOCK: 'Out of Stock', LOW_STOCK: 'Low Stock', RESTOCKED: 'Restocked',
    GRN_PENDING: 'GRN Pending', GRN_APPROVED: 'GRN Approved', GRN_REJECTED: 'GRN Rejected',
    PAYMENT_DUE: 'Payment Due', SYSTEM: 'System',
  };
  return map[type] ?? type;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsPage() {
  const router       = useRouter();
  const queryClient  = useQueryClient();
  const { connected } = useWebSocket();
  const [page, setPage]                       = useState(1);
  const [typeFilter, setTypeFilter]           = useState('');
  const [priorityFilter, setPriorityFilter]   = useState('');
  const [isReadFilter, setIsReadFilter]       = useState('');

  useEffect(() => setPage(1), [typeFilter, priorityFilter, isReadFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', { page, typeFilter, priorityFilter, isReadFilter }],
    queryFn: async () => {
      const { data } = await api.get('/notifications', {
        params: {
          page, limit: 30,
          type:     typeFilter     || undefined,
          priority: priorityFilter || undefined,
          isRead:   isReadFilter   || undefined,
        },
      });
      return data;
    },
    placeholderData: (prev: unknown) => prev,
  });

  useWebSocketEvent('notification.created',  () => queryClient.invalidateQueries({ queryKey: ['notifications'] }));
  useWebSocketEvent('notification.read',     () => queryClient.invalidateQueries({ queryKey: ['notifications'] }));
  useWebSocketEvent('notification.read_all', () => queryClient.invalidateQueries({ queryKey: ['notifications'] }));

  const markAllMutation = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All marked as read');
    },
    onError: () => toast.error('Failed'),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  function handleClick(n: Notification) {
    if (!n.isRead) markOneMutation.mutate(n.id);
    const dest = n.actionUrl ?? (
      n.type.includes('GRN') ? '/dashboard/grn' :
      n.type === 'OUT_OF_STOCK' || n.type === 'LOW_STOCK' || n.type === 'RESTOCKED' ? '/dashboard/products' :
      '/dashboard'
    );
    router.push(dest);
  }

  const notifications = (data?.data ?? []) as Notification[];
  const total         = (data?.total ?? 0) as number;
  const unread        = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      <Header
        title="Notifications"
        actions={
          <span className={`text-xs font-medium ${connected ? 'text-green-600' : 'text-gray-400'}`}>
            {connected ? '● Live' : '○ Offline'}
          </span>
        }
      />
      <main className="flex-1 p-6 max-w-3xl mx-auto space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Bell className="w-4 h-4" />
            <span className="font-medium">{total} notifications</span>
            {unread > 0 && (
              <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                {unread} unread
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#1B4F8A]">
              <option value="">All Types</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="RESTOCKED">Restocked</option>
              <option value="GRN_PENDING">GRN Pending</option>
              <option value="GRN_APPROVED">GRN Approved</option>
              <option value="SYSTEM">System</option>
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#1B4F8A]">
              <option value="">All Priority</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
            <select value={isReadFilter} onChange={(e) => setIsReadFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#1B4F8A]">
              <option value="">All</option>
              <option value="false">Unread</option>
              <option value="true">Read</option>
            </select>
            {unread > 0 && (
              <button
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                className="flex items-center gap-1.5 text-xs bg-[#1B4F8A] text-white px-3 py-1.5 rounded-lg hover:bg-[#163f6e] transition-colors disabled:opacity-60"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Bell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No notifications</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {notifications.map((n) => {
              const { cls, dot } = priorityBadge(n.priority, n.type);
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${!n.isRead ? 'border-l-4 border-l-blue-400 bg-blue-50/20' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {n.title}
                        </p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>
                            {typeLabel(n.type)}
                          </span>
                          <span className="text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                      {n.actionLabel && (
                        <span className="text-xs text-blue-600 font-medium mt-1 inline-block">{n.actionLabel} →</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {total > 30 && (
          <div className="flex items-center justify-center gap-2">
            {[...Array(Math.ceil(total / 30))].map((_, i) => (
              <button key={i} onClick={() => setPage(i + 1)}
                className={`w-8 h-8 rounded text-sm font-medium ${i + 1 === page ? 'bg-[#1B4F8A] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1B4F8A]'}`}>
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
