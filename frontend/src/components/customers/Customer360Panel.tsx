'use client';

// ─── Customer 360 panel ───────────────────────────────────────────────────────
// Shared "Timeline + Purchase Insights" view for a resolved Customer record.
// This is the SAME implementation rendered on the Customer detail page
// (frontend/src/app/dashboard/customers/[id]/page.tsx, "Timeline" tab) and
// embedded in the WhatsApp chat screen's "360" contact tab. Keep this as the
// single source of truth — do not fork/duplicate this logic in either caller.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ChevronLeft, ChevronRight, RefreshCw,
  ShoppingBag, CreditCard, FileText, MessageCircle, BookOpen, Receipt,
} from 'lucide-react';
import api from '@/lib/api';

const n = (v: unknown) => Number(v) || 0;
const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-xs">Page {page} of {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export function Customer360Panel({ customerId, dense = false }: { customerId: string; dense?: boolean }) {
  const [timelinePage, setTimelinePage] = useState(1);

  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ['customer', customerId, 'timeline', { page: timelinePage }],
    queryFn:  () => api.get(`/customers/${customerId}/timeline`, { params: { page: timelinePage, limit: 30 } }).then(r => r.data),
    enabled:  !!customerId,
    placeholderData: (prev: any) => prev,
  });

  const { data: insightsData, isLoading: insightsLoading } = useQuery({
    queryKey: ['customer', customerId, 'insights'],
    queryFn:  () => api.get(`/customers/${customerId}/insights`).then(r => r.data),
    enabled:  !!customerId,
    staleTime: 60_000,
  });

  return (
    <div>
      {/* Insights header */}
      {insightsLoading || !insightsData ? (
        <div className={`${dense ? 'px-3 py-3' : 'px-4 py-4'} border-b border-gray-100 text-xs text-gray-400`}>Loading insights…</div>
      ) : (
        (() => {
          const d = insightsData;
          const recencyLabel = d.daysSinceLastOrder === null ? 'Never' : d.daysSinceLastOrder === 0 ? 'Today' : d.daysSinceLastOrder === 1 ? 'Yesterday' : `${d.daysSinceLastOrder}d ago`;
          const recencyColor = d.daysSinceLastOrder === null ? 'text-gray-400' : d.daysSinceLastOrder <= 30 ? 'text-green-600 font-semibold' : d.daysSinceLastOrder <= 90 ? 'text-amber-600 font-semibold' : 'text-red-500 font-semibold';
          const maxSpend = Math.max(1, ...d.spendTrend.map((s: any) => s.total));
          return (
            <div className={`${dense ? 'px-3 py-3' : 'px-4 py-4'} border-b border-gray-100 space-y-4`}>
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[100px] bg-gray-50 rounded-xl px-4 py-3 space-y-0.5">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Last Order</p>
                  <p className={`text-sm ${recencyColor}`}>{recencyLabel}</p>
                </div>
                <div className="flex-1 min-w-[100px] bg-gray-50 rounded-xl px-4 py-3 space-y-0.5">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Orders (90d)</p>
                  <p className="text-sm font-semibold text-gray-800">{d.ordersLast90d}</p>
                </div>
                <div className="flex-1 min-w-[100px] bg-gray-50 rounded-xl px-4 py-3 space-y-0.5">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Avg Basket</p>
                  <p className="text-sm font-semibold text-gray-800">Rs. {inr(n(d.avgBasketValue))}</p>
                </div>
                <div className="flex-1 min-w-[100px] bg-gray-50 rounded-xl px-4 py-3 space-y-0.5">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Total Orders</p>
                  <p className="text-sm font-semibold text-gray-800">{d.totalOrders}</p>
                </div>
                {d.daysSinceLastOrder !== null && d.daysSinceLastOrder > 90 && (
                  <div className="flex-1 min-w-[140px] bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-red-500 font-medium">Gone Quiet</p>
                      <p className="text-xs text-red-400">No order in {d.daysSinceLastOrder}d</p>
                    </div>
                  </div>
                )}
              </div>

              {(d.favoriteProducts.length > 0 || d.spendTrend.some((s: any) => s.total > 0)) && (
                <div className="flex flex-wrap gap-4">
                  {d.favoriteProducts.length > 0 && (
                    <div className="flex-1 min-w-[200px]">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1.5">Favorite Products</p>
                      <div className="space-y-1">
                        {d.favoriteProducts.map((p: any) => (
                          <div key={p.name} className="flex items-center justify-between text-xs">
                            <span className="text-gray-700 truncate">{p.name}</span>
                            <span className="text-gray-400 shrink-0 ml-2">{p.qty} units</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1.5">Spend Trend (3mo)</p>
                    <div className="flex items-end gap-2 h-16">
                      {d.spendTrend.map((s: any) => (
                        <div key={s.month} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full bg-[#1B4F8A]/20 rounded-t" style={{ height: `${Math.max(4, (s.total / maxSpend) * 48)}px` }} />
                          <span className="text-[9px] text-gray-400">{s.month}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* Chronological feed */}
      {timelineLoading && !timelineData ? (
        <div className="py-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading timeline…
        </div>
      ) : !timelineData?.data?.length ? (
        <div className="py-12 text-center text-gray-400 text-sm">No activity recorded yet</div>
      ) : (
        <>
          <div className="divide-y divide-gray-50">
            {timelineData.data.map((e: any, i: number) => {
              const ICONS: Record<string, any> = {
                POS_BILL: Receipt, ONLINE_ORDER: ShoppingBag, PAYMENT: CreditCard,
                CREDIT_NOTE: FileText, WA_MESSAGE: MessageCircle, OFFLINE_LIST: BookOpen,
              };
              const COLORS: Record<string, string> = {
                POS_BILL: 'bg-blue-50 text-blue-500', ONLINE_ORDER: 'bg-purple-50 text-purple-500',
                PAYMENT: 'bg-green-50 text-green-500', CREDIT_NOTE: 'bg-amber-50 text-amber-500',
                WA_MESSAGE: 'bg-teal-50 text-teal-500', OFFLINE_LIST: 'bg-gray-100 text-gray-500',
              };
              const Icon = ICONS[e.type] ?? FileText;
              return (
                <div key={i} className={`${dense ? 'px-3 py-2.5' : 'px-4 py-3'} flex items-start gap-3 hover:bg-gray-50`}>
                  <div className={`shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center ${COLORS[e.type] ?? 'bg-gray-100 text-gray-500'}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {e.title}
                        {e.status === 'VOIDED' && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">Voided</span>}
                      </p>
                      {e.amount !== undefined && e.amount !== null && (
                        <span className="text-sm font-medium text-gray-700 shrink-0">Rs. {inr(n(e.amount))}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <span>{new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {e.subtitle && <span className="truncate">· {e.subtitle}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Pager page={timelinePage} totalPages={timelineData.meta?.totalPages ?? 1} onPage={setTimelinePage} />
        </>
      )}
    </div>
  );
}
