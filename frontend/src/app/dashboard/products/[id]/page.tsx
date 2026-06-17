'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RefreshCw, Edit2 } from 'lucide-react';
import api from '@/lib/api';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { EntityLink } from '@/components/shared/EntityLink';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { getUser } from '@/lib/auth';
import { canViewCost } from '@/lib/cost-visibility';
import { Tabs } from '@/components/shared/Tabs';
import { ProductImage } from '@/components/shared/ProductImage';
import toast from 'react-hot-toast';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const n = (v: unknown) => Number(v) || 0;
const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'plus' | 'stock-history' | 'sales' | 'purchases' | 'suppliers';

const MOVEMENT_BADGE: Record<string, string> = {
  PURCHASE:        'bg-green-100 text-green-700',
  SALE:            'bg-red-100 text-red-700',
  SALE_VOID:       'bg-orange-100 text-orange-700',
  SALE_RETURN:     'bg-blue-100 text-blue-700',
  OPENING_STOCK:   'bg-gray-100 text-gray-600',
  ADJUSTMENT_IN:   'bg-teal-100 text-teal-700',
  ADJUSTMENT_OUT:  'bg-amber-100 text-amber-700',
};

// ─── Pager ───────────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const qc      = useQueryClient();
  const { connected } = useWebSocket();

  const user    = getUser<{ role: string }>();
  const isOwner = canViewCost(user?.role);

  const [activeTab,     setActiveTab]     = useState<Tab>('plus');
  const [salesPage,     setSalesPage]     = useState(1);
  const [purchasesPage, setPurchasesPage] = useState(1);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn:  () => api.get(`/products/${id}`).then(r => r.data),
    enabled:  !!id,
  });

  const { data: plusData = [], isLoading: plusLoading } = useQuery<any[]>({
    queryKey: ['product', id, 'plus'],
    queryFn:  () => api.get(`/products/${id}/plus`).then(r => r.data),
    enabled:  !!id && activeTab === 'plus',
  });

  const { data: stockHistory = [], isLoading: stockLoading } = useQuery<any[]>({
    queryKey: ['product', id, 'stock-history'],
    queryFn:  () => api.get(`/products/${id}/stock-history`).then(r => r.data),
    enabled:  !!id && activeTab === 'stock-history',
  });

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['product', id, 'sales', { page: salesPage }],
    queryFn:  () => api.get(`/products/${id}/sales`, { params: { page: salesPage, limit: 20 } }).then(r => r.data),
    enabled:  !!id && activeTab === 'sales',
    placeholderData: (prev: any) => prev,
  });

  const { data: purchasesData, isLoading: purchasesLoading } = useQuery({
    queryKey: ['product', id, 'purchases', { page: purchasesPage }],
    queryFn:  () => api.get(`/products/${id}/purchases`, { params: { page: purchasesPage, limit: 20 } }).then(r => r.data),
    enabled:  !!id && activeTab === 'purchases',
    placeholderData: (prev: any) => prev,
  });

  const { data: suppliersData = [], isLoading: suppliersLoading } = useQuery<any[]>({
    queryKey: ['product', id, 'suppliers'],
    queryFn:  () => api.get(`/products/${id}/suppliers`).then(r => r.data),
    enabled:  !!id && activeTab === 'suppliers',
  });

  // ── Real-time ────────────────────────────────────────────────────────────────

  const invalidate = () => qc.invalidateQueries({ queryKey: ['product', id] });
  useWebSocketEvent('product.updated',          invalidate);
  useWebSocketEvent('plu.created',              invalidate);
  useWebSocketEvent('plu.updated',              invalidate);
  useWebSocketEvent('plu.archived',             invalidate);
  useWebSocketEvent('bill.created',             invalidate);
  useWebSocketEvent('grn.approved',             invalidate);
  useWebSocketEvent('inventory.stock-adjusted', invalidate);

  // ── Loading / error states ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Product" />
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-4 animate-pulse">
          <div className="h-5 w-48 bg-gray-200 rounded" />
          <div className="h-28 bg-gray-200 rounded-xl" />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Product" />
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-400">Product not found</div>
      </div>
    );
  }

  const stats        = product.stats ?? {};
  const sellingPrice = n(product.sellingPrice);
  const costPrice    = isOwner ? n(product.costPrice) : null;
  const margin       = (isOwner && costPrice !== null && sellingPrice > 0)
    ? ((sellingPrice - costPrice) / sellingPrice * 100)
    : null;
  const stock        = n(product.totalStock);
  const gstRate      = product.tax?.taxRate ?? product.gstRatePercent ?? 0;
  const cessRate     = (product as any).cessRate ?? 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Product" />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* Top nav */}
        <div className="flex items-center gap-3 flex-wrap">
          <BackButton fallbackHref="/dashboard/products" />
          <span className="text-gray-300">|</span>
          <Breadcrumbs items={[
            { label: 'Products', href: '/dashboard/products' },
            { label: product.name },
          ]} />
          <span className="ml-auto text-xs text-gray-400 font-mono">
            {connected ? '● Live' : '○ Offline'}
          </span>
        </div>

        {/* Product header */}
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {/* Image panel */}
              <div className="shrink-0">
                <div className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                  <ProductImage imageUrl={product.imageUrl} updatedAt={product.updatedAt} size="large" alt={product.name}
                    productId={product.id}
                    onUpdated={() => qc.invalidateQueries({ queryKey: ['product', id] })}
                  />
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingImage(true);
                    try {
                      const fd = new FormData();
                      fd.append('file', file);
                      await api.post(`/products/${id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                      qc.invalidateQueries({ queryKey: ['product', id] });
                      toast.success('Image updated');
                    } catch (err: any) {
                      toast.error(err?.response?.data?.message ?? 'Upload failed');
                    } finally {
                      setUploadingImage(false);
                      if (imageInputRef.current) imageInputRef.current.value = '';
                    }
                  }}
                />
                <div className="mt-1.5 flex gap-1">
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 text-gray-500 disabled:opacity-50"
                  >
                    {uploadingImage ? '…' : product.imageUrl ? 'Replace' : 'Upload'}
                  </button>
                  {product.imageUrl && (
                    <button
                      disabled={uploadingImage}
                      onClick={async () => {
                        setUploadingImage(true);
                        try {
                          await api.delete(`/products/${id}/image`);
                          qc.invalidateQueries({ queryKey: ['product', id] });
                          toast.success('Image removed');
                        } catch {
                          toast.error('Failed to remove image');
                        } finally { setUploadingImage(false); }
                      }}
                      className="text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50 text-red-500 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-semibold text-gray-900">{product.name}</h1>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${product.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {product.productType && product.productType !== 'STANDARD' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{product.productType}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  {product.productCode && (
                    <span className="font-mono text-xs bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                      Code: {product.productCode}
                    </span>
                  )}
                  {product.barcode && (
                    <span className="font-mono text-xs bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                      Barcode: {product.barcode}
                    </span>
                  )}
                  {product.category && <span>{product.category.name}</span>}
                  {product.brand && <span className="text-gray-400">{product.brand.name}</span>}
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push(`/dashboard/products?edit=${product.id}`)}
              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500"
              title="Edit product"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 6 Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

          <div className={`bg-white rounded-xl border px-5 py-4 ${stock <= 0 ? 'border-red-200' : stock <= n(product.reorderLevel) && n(product.reorderLevel) > 0 ? 'border-amber-200' : 'border-gray-200'}`}>
            <p className="text-xs text-gray-500 mb-1">Current Stock</p>
            <p className={`text-xl font-semibold ${stock <= 0 ? 'text-red-600' : stock <= n(product.reorderLevel) && n(product.reorderLevel) > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
              {stock % 1 === 0 ? stock.toFixed(0) : stock.toFixed(3)} {product.unitOfMeasure}
            </p>
            {stock <= 0
              ? <p className="text-xs text-red-500 mt-1">Out of stock</p>
              : n(product.reorderLevel) > 0 && stock <= n(product.reorderLevel)
                ? <p className="text-xs text-amber-500 mt-1">Below reorder level ({n(product.reorderLevel)})</p>
                : null
            }
          </div>

          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">Selling Price</p>
            <p className="text-xl font-semibold text-gray-700">Rs. {inr(sellingPrice)}</p>
            {n(product.mrp) > sellingPrice && (
              <p className="text-xs text-gray-400 mt-1">MRP: Rs. {inr(n(product.mrp))}</p>
            )}
          </div>

          {isOwner ? (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-xs text-gray-500 mb-1">Cost Price</p>
              <p className="text-xl font-semibold text-gray-700">Rs. {inr(costPrice!)}</p>
              {margin !== null && (
                <p className={`text-xs mt-1 ${margin < 0 ? 'text-red-500' : 'text-green-600'}`}>
                  Margin: {margin.toFixed(1)}%
                </p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-center">
              <p className="text-xs text-gray-400">Cost restricted</p>
            </div>
          )}

          {isOwner ? (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-xs text-gray-500 mb-1">Margin</p>
              <p className={`text-xl font-semibold ${margin !== null && margin < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                {margin !== null ? `${margin.toFixed(1)}%` : '—'}
              </p>
              {margin !== null && costPrice !== null && (
                <p className="text-xs text-gray-400 mt-1">
                  {margin >= 0
                    ? `Rs. ${inr(sellingPrice - costPrice)} / unit`
                    : 'Selling below cost'}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-center">
              <p className="text-xs text-gray-400">Margin restricted</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">Sold This Month</p>
            <p className="text-xl font-semibold text-gray-700">
              {n(stats.soldThisMonth).toFixed(0)} {product.unitOfMeasure}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">Lifetime Sold</p>
            <p className="text-xl font-semibold text-gray-700">
              {n(stats.lifetimeSold).toFixed(0)} {product.unitOfMeasure}
            </p>
            <p className="text-xs text-gray-400 mt-1">All time</p>
          </div>

        </div>

        {/* Body */}
        <div className="flex flex-col lg:flex-row gap-5">

          {/* Tabs */}
          <div className="flex-1 min-w-0">
            <Tabs
              tabs={[
                { key: 'plus', label: 'PLUs' },
                { key: 'stock-history', label: 'Stock History' },
                { key: 'sales', label: 'Sales' },
                { key: 'purchases', label: 'Purchases' },
                { key: 'suppliers', label: 'Suppliers' },
              ]}
              active={activeTab}
              onChange={(t) => setActiveTab(t as Tab)}
              className="bg-white rounded-t-xl px-4 pt-3"
            />

            <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 overflow-hidden">

              {/* PLUs */}
              {activeTab === 'plus' && (
                <div>
                  {plusLoading
                    ? <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
                    : plusData.length > 0
                      ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                                <th className="px-4 py-2.5 text-left font-medium">PLU Code</th>
                                <th className="px-4 py-2.5 text-left font-medium">EAN / Barcode</th>
                                <th className="px-4 py-2.5 text-right font-medium">MRP</th>
                                <th className="px-4 py-2.5 text-right font-medium">Selling</th>
                                <th className="px-4 py-2.5 text-right font-medium">Wholesale</th>
                                {isOwner && <th className="px-4 py-2.5 text-right font-medium">Cost</th>}
                                <th className="px-4 py-2.5 text-right font-medium">Stock</th>
                                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {plusData.map((p: any) => (
                                <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50 ${p.isDefault ? 'bg-blue-50/30' : ''}`}>
                                  <td className="px-4 py-2.5 font-mono text-xs">
                                    {p.pluCode}
                                    {p.isDefault && <span className="ml-1 text-xs text-blue-600">(default)</span>}
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                                    {p.eanCode ?? p.barcodes?.[0]?.barcodeValue ?? '—'}
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-gray-700">Rs. {inr(n(p.mrp))}</td>
                                  <td className="px-4 py-2.5 text-right font-medium text-gray-900">Rs. {inr(n(p.sellingPrice))}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-600">
                                    {p.wholesalePrice ? `Rs. ${inr(n(p.wholesalePrice))}` : '—'}
                                  </td>
                                  {isOwner && (
                                    <td className="px-4 py-2.5 text-right text-gray-600">
                                      {p.costPrice ? `Rs. ${inr(n(p.costPrice))}` : '—'}
                                    </td>
                                  )}
                                  <td className="px-4 py-2.5 text-right text-gray-600">{n(p.stockOnHand).toFixed(0)}</td>
                                  <td className="px-4 py-2.5">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                      p.isArchived ? 'bg-gray-100 text-gray-400'
                                        : !p.isActive ? 'bg-red-100 text-red-600'
                                        : 'bg-green-100 text-green-700'
                                    }`}>
                                      {p.isArchived ? 'Archived' : p.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                      : <div className="py-12 text-center text-gray-400 text-sm">No PLUs found</div>
                  }
                </div>
              )}

              {/* Stock History */}
              {activeTab === 'stock-history' && (
                <div>
                  {stockLoading
                    ? <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
                    : stockHistory.length > 0
                      ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                                <th className="px-4 py-2.5 text-left font-medium">Date</th>
                                <th className="px-4 py-2.5 text-left font-medium">Type</th>
                                <th className="px-4 py-2.5 text-left font-medium">Branch</th>
                                <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                                <th className="px-4 py-2.5 text-left font-medium">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stockHistory.map((s: any) => (
                                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(s.movementDate)}</td>
                                  <td className="px-4 py-2.5">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MOVEMENT_BADGE[s.movementType] ?? 'bg-gray-100 text-gray-600'}`}>
                                      {s.movementType.replace(/_/g, ' ')}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-gray-600">{s.branch?.name ?? '—'}</td>
                                  <td className={`px-4 py-2.5 text-right font-medium ${n(s.quantity) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                    {n(s.quantity) >= 0 ? '+' : ''}{Number(s.quantity).toFixed(3)}
                                  </td>
                                  <td className="px-4 py-2.5 text-gray-400 text-xs">{s.notes ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                      : <div className="py-12 text-center text-gray-400 text-sm">No stock movements found</div>
                  }
                </div>
              )}

              {/* Sales */}
              {activeTab === 'sales' && (
                <div>
                  {salesLoading
                    ? <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
                    : salesData?.data?.length > 0
                      ? (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                                  <th className="px-4 py-2.5 text-left font-medium">Bill #</th>
                                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                                  <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                                  <th className="px-4 py-2.5 text-right font-medium">Unit Price</th>
                                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {salesData.data.map((s: any) => (
                                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                                    <td className="px-4 py-2.5 font-mono text-xs">
                                      {s.bill
                                        ? <EntityLink type="bill" id={s.bill.id}>{s.bill.billNumber ?? s.bill.id.slice(-8)}</EntityLink>
                                        : '—'}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(s.bill?.billDate)}</td>
                                    <td className="px-4 py-2.5 text-right text-gray-700">{Number(s.quantity).toFixed(2)}</td>
                                    <td className="px-4 py-2.5 text-right text-gray-600">Rs. {inr(n(s.unitPrice))}</td>
                                    <td className="px-4 py-2.5 text-right font-medium">Rs. {inr(n(s.totalAmount))}</td>
                                    <td className="px-4 py-2.5">
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                        s.bill?.status === 'FINAL'     ? 'bg-green-100 text-green-700'
                                          : s.bill?.status === 'CANCELLED' ? 'bg-gray-100 text-gray-400'
                                          : 'bg-amber-100 text-amber-700'
                                      }`}>
                                        {s.bill?.status ?? '—'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <Pager page={salesPage} totalPages={salesData.totalPages ?? 1} onPage={setSalesPage} />
                        </>
                      )
                      : <div className="py-12 text-center text-gray-400 text-sm">No sales found</div>
                  }
                </div>
              )}

              {/* Purchases */}
              {activeTab === 'purchases' && (
                <div>
                  {purchasesLoading
                    ? <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
                    : purchasesData?.data?.length > 0
                      ? (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                                  <th className="px-4 py-2.5 text-left font-medium">GRN #</th>
                                  <th className="px-4 py-2.5 text-left font-medium">Supplier</th>
                                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                                  <th className="px-4 py-2.5 text-right font-medium">Qty Received</th>
                                  {isOwner && <th className="px-4 py-2.5 text-right font-medium">Unit Cost</th>}
                                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {purchasesData.data.map((p: any) => (
                                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                                    <td className="px-4 py-2.5 font-mono text-xs">
                                      {p.purchase
                                        ? <EntityLink type="grn" id={p.purchase.id}>{p.purchase.grnNumber ?? p.purchase.id.slice(-8)}</EntityLink>
                                        : '—'}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-700">
                                      {p.purchase?.supplierId
                                        ? <EntityLink type="supplier" id={p.purchase.supplierId}>{p.purchase.supplierName}</EntityLink>
                                        : (p.purchase?.supplierName ?? '—')}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(p.purchase?.invoiceDate)}</td>
                                    <td className="px-4 py-2.5 text-right text-gray-700">{Number(p.totalReceivedQty ?? 0).toFixed(2)}</td>
                                    {isOwner && (
                                      <td className="px-4 py-2.5 text-right text-gray-600">
                                        {p.netCostPrice ? `Rs. ${inr(n(p.netCostPrice))}` : '—'}
                                      </td>
                                    )}
                                    <td className="px-4 py-2.5">
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                        p.purchase?.status === 'APPROVED'  ? 'bg-green-100 text-green-700'
                                          : p.purchase?.status === 'REJECTED' ? 'bg-red-100 text-red-700'
                                          : 'bg-amber-100 text-amber-700'
                                      }`}>
                                        {p.purchase?.status ?? '—'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <Pager page={purchasesPage} totalPages={purchasesData.totalPages ?? 1} onPage={setPurchasesPage} />
                        </>
                      )
                      : <div className="py-12 text-center text-gray-400 text-sm">No purchases found</div>
                  }
                </div>
              )}

              {/* Suppliers */}
              {activeTab === 'suppliers' && (
                <div>
                  {suppliersLoading
                    ? <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
                    : suppliersData.length > 0
                      ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                                <th className="px-4 py-2.5 text-left font-medium">Supplier</th>
                                <th className="px-4 py-2.5 text-right font-medium">Times Ordered</th>
                                <th className="px-4 py-2.5 text-right font-medium">Total Qty</th>
                                {isOwner && <th className="px-4 py-2.5 text-right font-medium">Last Cost</th>}
                                <th className="px-4 py-2.5 text-left font-medium">Last Order</th>
                              </tr>
                            </thead>
                            <tbody>
                              {suppliersData.map((s: any) => (
                                <tr key={s.supplierId} className="border-b border-gray-50 hover:bg-gray-50">
                                  <td className="px-4 py-2.5">
                                    <EntityLink type="supplier" id={s.supplierId}>{s.supplierName}</EntityLink>
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-gray-600">{s.timesOrdered}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-600">{n(s.totalQty).toFixed(2)}</td>
                                  {isOwner && (
                                    <td className="px-4 py-2.5 text-right text-gray-600">
                                      {s.lastUnitCost !== null ? `Rs. ${inr(n(s.lastUnitCost))}` : '—'}
                                    </td>
                                  )}
                                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(s.lastOrderDate)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                      : <div className="py-12 text-center text-gray-400 text-sm">No suppliers found for this product</div>
                  }
                </div>
              )}

            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:w-72 shrink-0 space-y-4">

            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Product Info</h3>
              <dl className="space-y-2.5 text-sm">
                {product.hsnCode && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">HSN Code</dt>
                    <dd className="font-mono text-gray-800">{product.hsnCode}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">GST Rate</dt>
                  <dd className="font-medium text-gray-800">
                    {n(gstRate)}%{n(cessRate) > 0 ? ` + ${n(cessRate)}% cess` : ''}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Unit</dt>
                  <dd className="font-medium text-gray-800">{product.unitOfMeasure}</dd>
                </div>
                {product.barcode && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Barcode</dt>
                    <dd className="font-mono text-xs text-gray-800">{product.barcode}</dd>
                  </div>
                )}
                {product.brand && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Brand</dt>
                    <dd className="font-medium text-gray-800">{product.brand.name}</dd>
                  </div>
                )}
                {product.category && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Category</dt>
                    <dd className="font-medium text-gray-800 text-right max-w-[60%]">{product.category.name}</dd>
                  </div>
                )}
                {n(product.reorderLevel) > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Reorder Level</dt>
                    <dd className="font-medium text-gray-800">{n(product.reorderLevel)}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Stock Summary</h3>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Total Stock</dt>
                  <dd className="font-medium text-gray-800">{stock.toFixed(2)} {product.unitOfMeasure}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Sold This Month</dt>
                  <dd className="font-medium text-gray-800">{n(stats.soldThisMonth).toFixed(0)} {product.unitOfMeasure}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Lifetime Sold</dt>
                  <dd className="font-medium text-gray-800">{n(stats.lifetimeSold).toFixed(0)} {product.unitOfMeasure}</dd>
                </div>
              </dl>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
