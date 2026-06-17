'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Edit2, X, Check, Star, Power, ChevronDown, ChevronRight, AlertCircle, Link2, Scissors } from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getUser } from '@/lib/auth';
import { canViewCost } from '@/lib/cost-visibility';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductBasic {
  id: string;
  name: string;
  productCode: string | null;
  gstRatePercent: number | null;
  hsnCode: string | null;
}

interface Plu {
  id: string;
  pluCode: string;
  eanCode: string | null;
  basicCost: number;
  costPrice: number;
  mrp: number;
  sellingPrice: number;
  wholesalePrice: number | null;
  minSellingPrice: number | null;
  gstRate: number;
  cessRate: number;
  taxInclusive: boolean;
  stockOnHand: number;
  soldQty: number;
  isDefault: boolean;
  isActive: boolean;
  isArchived: boolean;
  archivedReason: string | null;
  displayName: string | null;
  availableOnline: boolean;
  onlinePrice: number | null;
  onlineStockCap: number | null;
  marginPercent: number | null;
  marginRs: number | null;
  createdAt: string;
  barcodes: { id: string; barcodeValue: string; barcodeType: string; isPrimary: boolean }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | string | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(n));

const EMPTY_ADD = {
  eanCode: '', basicCost: '', costPrice: '', mrp: '', sellingPrice: '',
  wholesalePrice: '', minSellingPrice: '', gstRate: '', hsnCode: '',
  cessRate: '0', taxInclusive: false, openingStock: '0',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PluManagePage() {
  const params = useParams();
  const id = params?.id as string;

  const showCost = canViewCost(getUser<{ role: string }>()?.role);

  const [product, setProduct]   = useState<ProductBasic | null>(null);
  const [plus, setPlus]         = useState<Plu[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  // Add panel
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addForm, setAddForm]   = useState({ ...EMPTY_ADD });
  const [saving, setSaving]     = useState(false);

  // Tax rates from DB
  const [taxRates, setTaxRates] = useState<{ id: string; taxName: string; taxCode: string; taxRate: number }[]>([]);

  // Edit panel
  const [editingPlu, setEditingPlu] = useState<Plu | null>(null);
  const [editForm, setEditForm] = useState({
    eanCode: '', sellingPrice: '', wholesalePrice: '', minSellingPrice: '',
    gstRate: '', cessRate: '', taxInclusive: false,
    availableOnline: false, onlinePrice: '', packLabel: '', onlineStockCap: '',
  });

  const [deactivatingId, setDeactivatingId]   = useState<string | null>(null);
  const [togglingOnlineId, setTogglingOnlineId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  // PLU Bundle (bulk ↔ single)
  const [bundles, setBundles]                   = useState<any[]>([]);
  const [showBundlePanel, setShowBundlePanel]   = useState(false);
  const [bundleForm, setBundleForm]             = useState({ bulkPluId: '', singlePluId: '', conversionQty: '1', notes: '' });
  const [savingBundle, setSavingBundle]         = useState(false);
  const [breakBulkForm, setBreakBulkForm] = useState<{
    bulkPluId: string; bulkPluCode: string; max: number;
    targets: { bundleId: string; singlePluCode: string; conversionQty: number; singlesQty: string }[];
  } | null>(null);
  const [breakBulkQty, setBreakBulkQty]         = useState('1');
  const [breakingBulk, setBreakingBulk]         = useState(false);
  const [bundleHistory, setBundleHistory]       = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [prodRes, plusRes, taxRes] = await Promise.all([
        api.get(`/products/${id}`),
        api.get(`/products/${id}/plus`),
        api.get('/products/taxes'),
      ]);
      setProduct(prodRes.data);
      setPlus(plusRes.data);
      setTaxRates(
        (taxRes.data ?? []).map((t: any) => ({
          id: t.id,
          taxName: t.taxName,
          taxCode: t.taxCode,
          taxRate: parseFloat(String(t.taxRate)),
        }))
      );
      // Load bundles for all PLUs of this product
      const allPlusData: any[] = plusRes.data ?? [];
      if (allPlusData.length > 0) {
        const bundleResults = await Promise.allSettled(
          allPlusData.map((p: any) => api.get(`/products/plu-bundles/${p.id}`))
        );
        const allBundles: any[] = [];
        bundleResults.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            const { asBulk, asSingle } = r.value.data;
            if (asBulk)             allBundles.push({ ...asBulk, role: 'bulk',   plu: allPlusData[i] });
            if (asSingle?.length)   asSingle.forEach((b: any) => allBundles.push({ ...b, role: 'single', plu: allPlusData[i] }));
          }
        });
        // Deduplicate by bundle id
        const seen = new Set<string>();
        setBundles(allBundles.filter(b => { if (seen.has(b.id)) return false; seen.add(b.id); return true; }));
        // Load history
        const histRes = await api.get(`/products/plu-bundles/${allPlusData[0].id}/history`).catch(() => ({ data: [] }));
        setBundleHistory(histRes.data ?? []);
      }
    } catch {
      toast.error('Failed to load PLUs');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Computed
  const addMrp  = Number(addForm.mrp) || 0;
  const addCost = Number(addForm.costPrice) || Number(addForm.basicCost) || 0;
  const addMarginRs  = addMrp > 0 ? addMrp - addCost : 0;
  const addMarginPct = addMrp > 0 ? ((addMrp - addCost) / addMrp) * 100 : 0;

  const activePlus   = plus.filter((p) => p.isActive && !p.isArchived);
  const archivedPlus = plus.filter((p) => !p.isActive || p.isArchived);

  async function handleSaveBundle() {
    if (!bundleForm.bulkPluId || !bundleForm.singlePluId) { toast.error('Select both PLUs'); return; }
    if (bundleForm.bulkPluId === bundleForm.singlePluId) { toast.error('Bulk and single PLU must be different'); return; }
    const qty = parseInt(bundleForm.conversionQty);
    if (!qty || qty < 1) { toast.error('Conversion qty must be at least 1'); return; }
    setSavingBundle(true);
    try {
      await api.post('/products/plu-bundles', {
        bulkPluId: bundleForm.bulkPluId, singlePluId: bundleForm.singlePluId,
        conversionQty: qty, notes: bundleForm.notes || undefined,
      });
      toast.success('Bundle linked');
      setShowBundlePanel(false);
      setBundleForm({ bulkPluId: '', singlePluId: '', conversionQty: '1', notes: '' });
      await loadData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to save bundle');
    } finally { setSavingBundle(false); }
  }

  async function handleDeleteBundle(bundleId: string) {
    if (!confirm('Remove this bundle link?')) return;
    try {
      await api.delete(`/products/plu-bundles/${bundleId}`);
      toast.success('Bundle removed');
      await loadData();
    } catch { toast.error('Failed to remove bundle'); }
  }

  async function handleBreakBulk() {
    if (!breakBulkForm) return;
    const bulkQty = parseInt(breakBulkQty);
    if (!bulkQty || bulkQty < 1) { toast.error('Enter bulk units to open'); return; }
    if (bulkQty > breakBulkForm.max) { toast.error(`Only ${breakBulkForm.max} in stock`); return; }
    const targets = breakBulkForm.targets
      .map(t => ({ bundleId: t.bundleId, singlesQty: parseInt(t.singlesQty) || 0 }))
      .filter(t => t.singlesQty > 0);
    if (!targets.length) { toast.error('Enter qty for at least one size'); return; }
    setBreakingBulk(true);
    try {
      const res = await api.post('/products/plu-bundles/break-bulk-multi', {
        bulkPluId: breakBulkForm.bulkPluId, bulkQty, targets,
      });
      toast.success(res.data.message);
      setBreakBulkForm(null);
      setBreakBulkQty('1');
      await loadData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Break bulk failed');
    } finally { setBreakingBulk(false); }
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handleAddPlu() {
    if (!addForm.mrp)          { toast.error('MRP required'); return; }
    if (!addForm.sellingPrice) { toast.error('Selling price required'); return; }
    if (Number(addForm.sellingPrice) > Number(addForm.mrp)) { toast.error('Selling price cannot exceed MRP'); return; }
    setSaving(true);
    try {
      await api.post(`/products/${id}/plus`, {
        eanCode:        addForm.eanCode || undefined,
        basicCost:      addForm.basicCost ? Number(addForm.basicCost) : undefined,
        costPrice:      addForm.costPrice ? Number(addForm.costPrice) : undefined,
        mrp:            Number(addForm.mrp),
        sellingPrice:   Number(addForm.sellingPrice),
        wholesalePrice: addForm.wholesalePrice ? Number(addForm.wholesalePrice) : undefined,
        minSellingPrice: addForm.minSellingPrice ? Number(addForm.minSellingPrice) : undefined,
        gstRate:        addForm.gstRate ? Number(addForm.gstRate) : undefined,
        hsnCode:        addForm.hsnCode || undefined,
        cessRate:       addForm.cessRate ? Number(addForm.cessRate) : undefined,
        taxInclusive:   addForm.taxInclusive,
        openingStock:   Number(addForm.openingStock) || 0,
      });
      toast.success('PLU created');
      setShowAddPanel(false);
      setAddForm({ ...EMPTY_ADD });
      await loadData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to create PLU');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdatePlu() {
    if (!editingPlu) return;
    setSaving(true);
    try {
      await api.patch(`/products/${id}/plus/${editingPlu.id}`, {
        eanCode:         editForm.eanCode || undefined,
        sellingPrice:    editForm.sellingPrice ? Number(editForm.sellingPrice) : undefined,
        wholesalePrice:  editForm.wholesalePrice ? Number(editForm.wholesalePrice) : undefined,
        minSellingPrice: editForm.minSellingPrice ? Number(editForm.minSellingPrice) : undefined,
        gstRate:         editForm.gstRate ? Number(editForm.gstRate) : undefined,
        cessRate:        editForm.cessRate ? Number(editForm.cessRate) : undefined,
        taxInclusive:    editForm.taxInclusive,
        availableOnline: editForm.availableOnline,
        onlinePrice:     editForm.onlinePrice !== '' ? Number(editForm.onlinePrice) : null,
        onlineStockCap:  editForm.onlineStockCap !== '' ? Number(editForm.onlineStockCap) : null,
        packLabel:       editForm.packLabel.trim() || null,
      });
      toast.success('PLU updated');
      setEditingPlu(null);
      await loadData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to update PLU');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(pluId: string) {
    setSettingDefaultId(pluId);
    try {
      await api.post(`/products/${id}/plus/${pluId}/set-default`);
      toast.success('Default PLU updated');
      await loadData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to set default');
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function handleToggleOnline(plu: Plu) {
    setTogglingOnlineId(plu.id);
    try {
      await api.patch(`/products/${id}/plus/${plu.id}`, {
        availableOnline: !plu.availableOnline,
      });
      await loadData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to update online status');
    } finally {
      setTogglingOnlineId(null);
    }
  }

  async function handleDeactivate(pluId: string) {
    setDeactivatingId(pluId);
    try {
      await api.post(`/products/${id}/plus/${pluId}/deactivate`);
      toast.success('PLU deactivated');
      await loadData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to deactivate');
    } finally {
      setDeactivatingId(null);
    }
  }

  function openEdit(plu: Plu) {
    setEditingPlu(plu);
    setEditForm({
      eanCode:         plu.eanCode ?? '',
      sellingPrice:    String(plu.sellingPrice),
      wholesalePrice:  plu.wholesalePrice ? String(plu.wholesalePrice) : '',
      minSellingPrice: plu.minSellingPrice ? String(plu.minSellingPrice) : '',
      gstRate:         String(plu.gstRate),
      cessRate:        String(plu.cessRate ?? 0),
      taxInclusive:    plu.taxInclusive,
      availableOnline: plu.availableOnline,
      onlinePrice:     plu.onlinePrice != null ? String(plu.onlinePrice) : '',
      onlineStockCap:  plu.onlineStockCap != null ? String(plu.onlineStockCap) : '',
      packLabel:       plu.displayName ?? '',
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <Header title="PLU Management" />
        <main className="flex-1 p-6">
          <div className="animate-pulse space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="PLU Management" />
      <main className="flex-1 p-6 space-y-4">

        {/* Product header */}
        <div className="flex items-center gap-3">
          <BackButton fallbackHref={`/dashboard/products/${id}`} />
          <div>
            <Breadcrumbs items={[
              { label: 'Products', href: '/dashboard/products' },
              { label: product?.name ?? '...', href: `/dashboard/products/${id}` },
              { label: 'PLU Management' },
            ]} />
            <p className="text-xs text-gray-400 font-mono mt-0.5">{product?.productCode ?? '—'}</p>
          </div>
          <button
            onClick={() => {
              setShowAddPanel(true);
              setAddForm({ ...EMPTY_ADD, gstRate: String(product?.gstRatePercent ?? ''), hsnCode: product?.hsnCode ?? '' });
            }}
            className="ml-auto flex items-center gap-1.5 bg-[#1B4F8A] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#163f6e] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add New PLU
          </button>
        </div>

        {/* Active PLUs */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Active PLUs</h2>
            <span className="text-xs text-gray-400">{activePlus.length} active</span>
          </div>
          {activePlus.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No active PLUs. Add the first one.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 font-medium border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5">PLU Code</th>
                    <th className="text-left px-4 py-2.5">Barcode</th>
                    {showCost && <th className="text-right px-4 py-2.5">Basic Cost</th>}
                    {showCost && <th className="text-right px-4 py-2.5">Cost Price</th>}
                    <th className="text-right px-4 py-2.5">MRP</th>
                    <th className="text-right px-4 py-2.5">Sale Price</th>
                    <th className="text-center px-4 py-2.5">Online</th>
                    <th className="text-center px-4 py-2.5" title="Maximum units available for online orders">Online Cap</th>
                    {showCost && <th className="text-right px-4 py-2.5">Margin</th>}
                    <th className="text-right px-4 py-2.5">Stock</th>
                    <th className="px-4 py-2.5 w-28"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activePlus.map((plu) => {
                    const isEditing = editingPlu?.id === plu.id;
                    const colSpan = 6 + (showCost ? 4 : 0); // total columns
                    return (
                      <React.Fragment key={plu.id}>
                        {/* ── Main display row ── */}
                        <tr className={`${isEditing ? 'bg-blue-50/60' : 'hover:bg-gray-50/80'} ${plu.isDefault && !isEditing ? 'bg-blue-50/30' : ''}`}>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{plu.pluCode}</span>
                            {plu.isDefault && (
                              <span className="ml-1.5 text-xs bg-[#1B4F8A] text-white px-1.5 py-0.5 rounded font-medium">Default</span>
                            )}
                            {plu.displayName && (
                              <div className="text-xs text-gray-500 mt-0.5">{plu.displayName}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                            {plu.barcodes.find((b) => b.isPrimary)?.barcodeValue ?? plu.eanCode ?? '—'}
                          </td>
                          {showCost && <td className="px-4 py-3 text-right text-gray-600">₹{fmt(plu.basicCost)}</td>}
                          {showCost && <td className="px-4 py-3 text-right text-gray-600">₹{fmt(plu.costPrice)}</td>}
                          <td className="px-4 py-3 text-right text-gray-700">₹{fmt(plu.mrp)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-[#1B4F8A]">₹{fmt(plu.sellingPrice)}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleToggleOnline(plu)}
                                disabled={togglingOnlineId === plu.id}
                                title={plu.availableOnline ? 'Remove from online store' : 'Publish to online store'}
                                className={`w-9 h-5 rounded-full transition-colors relative disabled:opacity-50 ${plu.availableOnline ? 'bg-green-500' : 'bg-gray-300'}`}
                              >
                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${plu.availableOnline ? 'translate-x-4' : ''}`} />
                              </button>
                              {plu.availableOnline && plu.onlinePrice != null && (
                                <span className="text-xs text-green-700 font-medium">₹{fmt(plu.onlinePrice)}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {plu.availableOnline ? (
                              plu.onlineStockCap != null ? (
                                <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                  Cap: {plu.onlineStockCap}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400" title="No cap — uses total stock">No cap</span>
                              )
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          {showCost && (
                            <td className="px-4 py-3 text-right">
                              {plu.marginPercent != null ? (
                                <span className={`text-xs font-medium ${Number(plu.marginPercent) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                  {Number(plu.marginPercent).toFixed(1)}%
                                </span>
                              ) : '—'}
                            </td>
                          )}
                          <td className={`px-4 py-3 text-right font-medium ${Number(plu.stockOnHand) <= 0 ? 'text-red-600' : 'text-gray-700'}`}>
                            {Number(plu.stockOnHand)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              {!plu.isDefault && (
                                <button
                                  onClick={() => handleSetDefault(plu.id)}
                                  disabled={settingDefaultId === plu.id}
                                  title="Set as default"
                                  className="p-1.5 rounded text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors disabled:opacity-50"
                                >
                                  <Star className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => isEditing ? setEditingPlu(null) : openEdit(plu)}
                                title={isEditing ? 'Cancel edit' : 'Edit PLU'}
                                className={`p-1.5 rounded transition-colors ${isEditing ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-[#1B4F8A] hover:bg-blue-50'}`}
                              >
                                {isEditing ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                              </button>
                              {!isEditing && (
                                <button
                                  onClick={() => handleDeactivate(plu.id)}
                                  disabled={deactivatingId === plu.id}
                                  title="Deactivate"
                                  className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* ── Inline edit sub-row ── */}
                        {isEditing && (
                          <tr key={`${plu.id}-edit`} className="bg-blue-50/40 border-t-0">
                            <td colSpan={colSpan} className="px-4 pb-4 pt-2">
                              <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-3 shadow-sm">
                                {/* Row 1: prices */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div>
                                    <label className="text-[11px] font-medium text-gray-500 block mb-1">Selling Price (₹) *</label>
                                    <input autoFocus type="number" value={editForm.sellingPrice}
                                      onChange={e => setEditForm(f => ({ ...f, sellingPrice: e.target.value }))}
                                      className="inp" min={0} step="0.01" />
                                  </div>
                                  <div>
                                    <label className="text-[11px] font-medium text-gray-500 block mb-1">Wholesale Price (₹)</label>
                                    <input type="number" value={editForm.wholesalePrice}
                                      onChange={e => setEditForm(f => ({ ...f, wholesalePrice: e.target.value }))}
                                      className="inp" min={0} step="0.01" />
                                  </div>
                                  <div>
                                    <label className="text-[11px] font-medium text-gray-500 block mb-1">Min Selling Price (₹)</label>
                                    <input type="number" value={editForm.minSellingPrice}
                                      onChange={e => setEditForm(f => ({ ...f, minSellingPrice: e.target.value }))}
                                      className="inp" min={0} step="0.01" />
                                  </div>
                                  <div>
                                    <label className="text-[11px] font-medium text-gray-500 block mb-1">EAN / Barcode</label>
                                    <input value={editForm.eanCode}
                                      onChange={e => setEditForm(f => ({ ...f, eanCode: e.target.value }))}
                                      className="inp" placeholder="Optional" />
                                  </div>
                                </div>

                                {/* Row 2: tax + pack label */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div>
                                    <label className="text-[11px] font-medium text-gray-500 block mb-1">GST Rate %</label>
                                    <select value={editForm.gstRate}
                                      onChange={e => setEditForm(f => ({ ...f, gstRate: e.target.value }))}
                                      className="inp">
                                      <option value="">— select —</option>
                                      {taxRates.map(t => (
                                        <option key={t.id} value={String(t.taxRate)}>{t.taxRate}% — {t.taxName}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[11px] font-medium text-gray-500 block mb-1">CESS Rate %</label>
                                    <input type="number" value={editForm.cessRate}
                                      onChange={e => setEditForm(f => ({ ...f, cessRate: e.target.value }))}
                                      className="inp" min={0} step="0.01" />
                                  </div>
                                  <div className="sm:col-span-2">
                                    <label className="text-[11px] font-medium text-gray-500 block mb-1">Pack Label (shopper-facing)</label>
                                    <input value={editForm.packLabel}
                                      onChange={e => setEditForm(f => ({ ...f, packLabel: e.target.value }))}
                                      className="inp" placeholder="e.g. 1 Litre, 500 g, Pack of 12" maxLength={60} />
                                  </div>
                                </div>

                                {/* Row 3: toggles + online price */}
                                <div className="flex flex-wrap items-center gap-4">
                                  <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <button type="button"
                                      onClick={() => setEditForm(f => ({ ...f, taxInclusive: !f.taxInclusive }))}
                                      className={`w-9 h-5 rounded-full transition-colors relative ${editForm.taxInclusive ? 'bg-[#1B4F8A]' : 'bg-gray-300'}`}>
                                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editForm.taxInclusive ? 'translate-x-4' : ''}`} />
                                    </button>
                                    <span className="text-xs text-gray-600">Tax Inclusive</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <button type="button"
                                      onClick={() => setEditForm(f => ({ ...f, availableOnline: !f.availableOnline }))}
                                      className={`w-9 h-5 rounded-full transition-colors relative ${editForm.availableOnline ? 'bg-green-500' : 'bg-gray-300'}`}>
                                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editForm.availableOnline ? 'translate-x-4' : ''}`} />
                                    </button>
                                    <span className="text-xs text-gray-600">Available Online</span>
                                  </label>
                                  {editForm.availableOnline && (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <label className="text-[11px] font-medium text-gray-500 whitespace-nowrap">Online Price (₹)</label>
                                        <input type="number" value={editForm.onlinePrice}
                                          onChange={e => setEditForm(f => ({ ...f, onlinePrice: e.target.value }))}
                                          className="inp w-28" min={0} step="0.01"
                                          placeholder={`Default: ${plu.sellingPrice}`} />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <label className="text-[11px] font-medium text-gray-500 whitespace-nowrap">Online Cap</label>
                                        <input type="number" value={editForm.onlineStockCap}
                                          onChange={e => setEditForm(f => ({ ...f, onlineStockCap: e.target.value }))}
                                          className="inp w-24" min={0} step="1" placeholder="No cap" />
                                      </div>
                                    </>
                                  )}
                                </div>

                                {/* Row 4: save/cancel */}
                                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                                  <button onClick={handleUpdatePlu} disabled={saving}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4F8A] text-white text-sm font-semibold rounded-lg hover:bg-[#163f6e] disabled:opacity-60 transition-colors">
                                    <Check className="w-3.5 h-3.5" />{saving ? 'Saving…' : 'Save Changes'}
                                  </button>
                                  <button onClick={() => setEditingPlu(null)}
                                    className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                    Cancel
                                  </button>
                                  <span className="text-xs text-gray-400 ml-2">MRP ₹{fmt(plu.mrp)} · Cost ₹{fmt(plu.costPrice)} — locked</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Archived / Inactive PLUs */}
        {archivedPlus.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <span>Archived / Inactive PLUs ({archivedPlus.length})</span>
              {showArchived ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {showArchived && (
              <div className="overflow-x-auto border-t border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-400 font-medium border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2">PLU Code</th>
                      <th className="text-right px-4 py-2">MRP</th>
                      <th className="text-right px-4 py-2">Sale Price</th>
                      <th className="text-right px-4 py-2">Sold Qty</th>
                      <th className="text-left px-4 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 opacity-70">
                    {archivedPlus.map((plu) => (
                      <tr key={plu.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5"><span className="font-mono text-xs text-gray-400">{plu.pluCode}</span></td>
                        <td className="px-4 py-2.5 text-right text-xs text-gray-500">₹{fmt(plu.mrp)}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-gray-500">₹{fmt(plu.sellingPrice)}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-gray-500">{Number(plu.soldQty)}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">{plu.archivedReason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {/* ── PLU Bundle (Bulk ↔ Single) ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#1B4F8A]" />
              <span className="font-semibold text-sm text-gray-800">Bulk ↔ Single Linking</span>
              {bundles.length > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{bundles.length}</span>}
            </div>
            <button onClick={() => setShowBundlePanel(true)}
              className="flex items-center gap-1 text-xs text-[#1B4F8A] hover:underline">
              <Plus className="w-3 h-3" /> Link PLUs
            </button>
          </div>

          {bundles.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-gray-400">
              No bulk/single links yet.
              <button onClick={() => setShowBundlePanel(true)} className="text-[#1B4F8A] hover:underline ml-1">
                Link a pack PLU to a single PLU
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {bundles.map(b => (
                <div key={b.id} className="px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 grid grid-cols-3 gap-4 items-center text-sm">
                    <div className="text-center">
                      <div className="text-xs text-gray-400 mb-0.5">BULK PLU</div>
                      <div className="font-mono font-semibold text-gray-800">{b.bulkPlu?.pluCode ?? b.bulkPluId}</div>
                      <div className="text-xs text-gray-400">Stock: {Number(b.bulkPlu?.stockOnHand ?? 0).toFixed(2)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl text-gray-300">⇄</div>
                      <div className="text-xs font-bold text-[#1B4F8A]">1 bulk = {b.conversionQty} singles</div>
                      {b.notes && <div className="text-xs text-gray-400 italic">{b.notes}</div>}
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-400 mb-0.5">SINGLE PLU</div>
                      <div className="font-mono font-semibold text-gray-800">{b.singlePlu?.pluCode ?? b.singlePluId}</div>
                      <div className="text-xs text-gray-400">Stock: {Number(b.singlePlu?.stockOnHand ?? 0).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        // Gather ALL bundles sharing this same bulk PLU
                        const bulkPluId = b.bulkPluId ?? b.bulkPlu?.id;
                        const allTargets = bundles
                          .filter(x => (x.bulkPluId ?? x.bulkPlu?.id) === bulkPluId)
                          .map(x => ({
                            bundleId: x.id,
                            singlePluCode: x.singlePlu?.pluCode ?? x.singlePluId,
                            conversionQty: x.conversionQty,
                            singlesQty: '',
                          }));
                        setBreakBulkForm({
                          bulkPluId,
                          bulkPluCode: b.bulkPlu?.pluCode ?? bulkPluId,
                          max: Number(b.bulkPlu?.stockOnHand ?? 0),
                          targets: allTargets,
                        });
                        setBreakBulkQty('1');
                      }}
                      className="flex items-center gap-1 text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600"
                    >
                      <Scissors className="w-3 h-3" /> Break Bulk
                    </button>
                    <button onClick={() => handleDeleteBundle(b.id)}
                      className="text-gray-300 hover:text-red-500 p-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Break Bulk modal — multi-size */}
          {breakBulkForm && (() => {
            const bulkQty = parseInt(breakBulkQty) || 0;
            const totalAccounted = breakBulkForm.targets.reduce((s, t) => {
              const singles = parseInt(t.singlesQty) || 0;
              return s + (t.conversionQty > 0 ? singles / t.conversionQty : 0);
            }, 0);
            const diff = Math.round((bulkQty - totalAccounted) * 1000) / 1000;
            return (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-amber-500" /> Break Bulk
                  </h3>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                    Bulk PLU: <strong>{breakBulkForm.bulkPluCode}</strong> — Available stock: <strong>{breakBulkForm.max}</strong>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">How many bulk units to open?</label>
                    <input type="number" min="1" max={breakBulkForm.max} value={breakBulkQty}
                      onChange={e => setBreakBulkQty(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]"
                      autoFocus />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600 block">How many of each size are you making?</label>
                    {breakBulkForm.targets.map((t, i) => (
                      <div key={t.bundleId} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex-1 text-sm font-mono text-gray-700">{t.singlePluCode}</div>
                        <div className="text-xs text-gray-400 shrink-0">
                          (1 bulk = {t.conversionQty} of these)
                        </div>
                        <input
                          type="number" min="0" value={t.singlesQty} placeholder="0"
                          onChange={e => setBreakBulkForm(f => f ? {
                            ...f,
                            targets: f.targets.map((x, j) => j === i ? { ...x, singlesQty: e.target.value } : x),
                          } : f)}
                          className="w-20 border border-gray-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-[#1B4F8A]"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Accounting summary */}
                  {bulkQty > 0 && (
                    <div className={`rounded-lg px-3 py-2 text-xs flex items-center justify-between ${
                      Math.abs(diff) < 0.01 ? 'bg-green-50 text-green-800 border border-green-200'
                      : diff > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      <span>Total accounted: <strong>{totalAccounted.toFixed(3)}</strong> of <strong>{bulkQty}</strong> bulk units</span>
                      {Math.abs(diff) >= 0.01 && (
                        <span>{diff > 0 ? `${diff.toFixed(3)} unaccounted (wastage/loss)` : `Over by ${Math.abs(diff).toFixed(3)}`}</span>
                      )}
                      {Math.abs(diff) < 0.01 && <span>✓ Balanced</span>}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setBreakBulkForm(null)}
                      className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
                    <button onClick={handleBreakBulk} disabled={breakingBulk}
                      className="flex-1 py-2.5 text-sm bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-60 font-medium">
                      {breakingBulk ? 'Opening…' : 'Open Bulk'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Bundle history */}
          {bundleHistory.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3">
              <div className="text-xs font-semibold text-gray-500 mb-2">Recent Break Bulk Operations</div>
              <div className="space-y-1">
                {bundleHistory.slice(0, 5).map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between text-xs text-gray-500">
                    <span>{new Date(h.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    <span>Opened <strong>{h.bulkQtyBroken}</strong> bulk → <strong>{h.singlesCreated}</strong> singles</span>
                    <span className="text-gray-300">{h.createdByName ?? 'System'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </main>

      {/* ── Link PLU Bundle Panel ── */}
      {showBundlePanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowBundlePanel(false)} />
          <div className="w-full max-w-sm bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-900 flex items-center gap-2"><Link2 className="w-4 h-4" /> Link Bulk ↔ Single PLU</h2>
              <button onClick={() => setShowBundlePanel(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                Link a pack/bulk PLU to its single-unit PLU. When you "Break Bulk", stock converts from bulk to singles.
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Bulk PLU (the box/pack) *</label>
                <select value={bundleForm.bulkPluId} onChange={e => setBundleForm(f => ({ ...f, bulkPluId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]">
                  <option value="">— Select bulk PLU —</option>
                  {activePlus.map(p => <option key={p.id} value={p.id}>{p.pluCode} — ₹{p.mrp} (stock: {Number(p.stockOnHand).toFixed(0)})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">1 bulk unit equals how many singles? *</label>
                <input type="number" min="1" value={bundleForm.conversionQty}
                  onChange={e => setBundleForm(f => ({ ...f, conversionQty: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]"
                  placeholder="e.g. 10" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Single PLU (the individual unit) *</label>
                <select value={bundleForm.singlePluId} onChange={e => setBundleForm(f => ({ ...f, singlePluId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]">
                  <option value="">— Select single PLU —</option>
                  {activePlus.map(p => <option key={p.id} value={p.id}>{p.pluCode} — ₹{p.mrp} (stock: {Number(p.stockOnHand).toFixed(0)})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notes (optional)</label>
                <input value={bundleForm.notes} onChange={e => setBundleForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. 1 box = 10 blades"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]" />
              </div>
              {bundleForm.bulkPluId && bundleForm.singlePluId && bundleForm.conversionQty && (
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 border border-gray-200">
                  Preview: 1 × <strong>{activePlus.find(p => p.id === bundleForm.bulkPluId)?.pluCode}</strong>
                  {' '}→ opens into{' '}
                  <strong>{bundleForm.conversionQty}</strong> × <strong>{activePlus.find(p => p.id === bundleForm.singlePluId)?.pluCode}</strong>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowBundlePanel(false)}
                className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveBundle} disabled={savingBundle}
                className="flex-1 py-2.5 text-sm bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163d6d] disabled:opacity-60 font-medium">
                {savingBundle ? 'Saving…' : 'Save Bundle Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add New PLU Panel ── */}
      {showAddPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowAddPanel(false)} />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-800">Add New PLU</h2>
              <button onClick={() => setShowAddPanel(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 p-5 space-y-3 overflow-y-auto">
              <PluFld label="EAN Code">
                <input value={addForm.eanCode} onChange={(e) => setAddForm((f) => ({ ...f, eanCode: e.target.value }))} className="inp" placeholder="Optional barcode" />
              </PluFld>
              {showCost && (
                <div className="grid grid-cols-2 gap-3">
                  <PluFld label="Basic Cost (₹)">
                    <input type="number" value={addForm.basicCost} onChange={(e) => setAddForm((f) => ({ ...f, basicCost: e.target.value }))} className="inp" min={0} step="0.01" />
                  </PluFld>
                  <PluFld label="Cost Price (₹)">
                    <input type="number" value={addForm.costPrice} onChange={(e) => setAddForm((f) => ({ ...f, costPrice: e.target.value }))} className="inp" min={0} step="0.01" />
                  </PluFld>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <PluFld label="MRP (₹) *">
                  <input type="number" value={addForm.mrp} onChange={(e) => setAddForm((f) => ({ ...f, mrp: e.target.value }))} className="inp" min={0} step="0.01" />
                </PluFld>
                <PluFld label="Selling Price (₹) *">
                  <input type="number" value={addForm.sellingPrice} onChange={(e) => setAddForm((f) => ({ ...f, sellingPrice: e.target.value }))} className="inp" min={0} step="0.01" />
                </PluFld>
              </div>

              {/* Live margin (cost-viewers only) */}
              {showCost && addMrp > 0 && addCost > 0 && (
                <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-3 ${addMarginRs >= 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  <span>Margin: ₹{addMarginRs.toFixed(2)}</span>
                  <span>({addMarginPct.toFixed(1)}%)</span>
                  {addMarginRs < 0 && <AlertCircle className="w-3.5 h-3.5" />}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <PluFld label="Wholesale Price (₹)">
                  <input type="number" value={addForm.wholesalePrice} onChange={(e) => setAddForm((f) => ({ ...f, wholesalePrice: e.target.value }))} className="inp" min={0} step="0.01" />
                </PluFld>
                <PluFld label="Min Selling Price (₹)">
                  <input type="number" value={addForm.minSellingPrice} onChange={(e) => setAddForm((f) => ({ ...f, minSellingPrice: e.target.value }))} className="inp" min={0} step="0.01" />
                </PluFld>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <PluFld label="GST Rate %">
                  <select
                    value={addForm.gstRate}
                    onChange={(e) => setAddForm((f) => ({ ...f, gstRate: e.target.value }))}
                    className="inp"
                  >
                    <option value="">— select —</option>
                    {taxRates.map((t) => (
                      <option key={t.id} value={String(t.taxRate)}>
                        {t.taxRate}% — {t.taxName}
                      </option>
                    ))}
                  </select>
                </PluFld>
                <PluFld label="CESS Rate %">
                  <input type="number" value={addForm.cessRate} onChange={(e) => setAddForm((f) => ({ ...f, cessRate: e.target.value }))} className="inp" min={0} step="0.01" />
                </PluFld>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <PluFld label="HSN Code">
                  <input value={addForm.hsnCode} onChange={(e) => setAddForm((f) => ({ ...f, hsnCode: e.target.value.replace(/\D/g, '').slice(0, 8) }))} className="inp" placeholder="e.g. 1512" />
                </PluFld>
                <PluFld label="Opening Stock">
                  <input type="number" value={addForm.openingStock} onChange={(e) => setAddForm((f) => ({ ...f, openingStock: e.target.value }))} className="inp" min={0} />
                </PluFld>
              </div>
              <div className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2.5">
                <span className="text-xs font-medium text-gray-700">Tax Inclusive</span>
                <button
                  type="button"
                  onClick={() => setAddForm((f) => ({ ...f, taxInclusive: !f.taxInclusive }))}
                  className={`w-9 h-5 rounded-full transition-colors relative ${addForm.taxInclusive ? 'bg-[#1B4F8A]' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${addForm.taxInclusive ? 'translate-x-4' : ''}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-gray-200">
              <button onClick={() => setShowAddPanel(false)} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddPlu} disabled={saving}
                className="flex-1 py-2.5 text-sm bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163f6e] disabled:opacity-60 flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />{saving ? 'Saving…' : 'Create PLU'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit PLU is now inline — see table row above */}

      <style jsx global>{`
        .inp { width:100%; padding:0.5rem 0.75rem; font-size:0.875rem; border:1px solid #e5e7eb; border-radius:0.5rem; outline:none; background:white; transition:border-color 0.15s; }
        .inp:focus { border-color:#1B4F8A; }
        .inp:disabled { background:#f9fafb; color:#9ca3af; cursor:not-allowed; }
      `}</style>
    </>
  );
}

function PluFld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}
