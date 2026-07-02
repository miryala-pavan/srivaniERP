'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Edit2, X, Check, Star, Power, ChevronDown, ChevronRight, AlertCircle, Link2, Scissors, Search } from 'lucide-react';
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
  // UOM
  measureType: string | null;
  unitSymbol: string | null;
  unitSize: number | null;
  baseUnitQty: number | null;
  gstUqc: string | null;
  isLoose: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | string | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(n));

const UNIT_SYMBOLS: Record<string, string[]> = {
  WEIGHT: ['kg', 'g'],
  VOLUME: ['L', 'ml'],
  COUNT:  ['pcs', 'nos', 'ctn', 'box', 'doz', 'btl', 'bag', 'pkt'],
};

const UQC_MAP: Record<string, string> = {
  kg: 'KGS', g: 'GMS', L: 'LTR', ml: 'MLT',
  pcs: 'PCS', nos: 'NOS', ctn: 'CTN', box: 'BOX',
  doz: 'DOZ', btl: 'BTL', bag: 'BAG', pkt: 'PAC',
};

function calcBaseUnitQty(unitSymbol: string, unitSize: number): number {
  if (unitSymbol === 'kg' || unitSymbol === 'L') return unitSize * 1000;
  return unitSize;
}

function fmtBaseQty(symbol: string, qty: number): string {
  if (symbol === 'kg' || symbol === 'g') return `${qty.toLocaleString('en-IN')} g`;
  if (symbol === 'L' || symbol === 'ml') return `${qty.toLocaleString('en-IN')} ml`;
  return `${qty}`;
}

const EMPTY_ADD = {
  eanCode: '', basicCost: '', costPrice: '', mrp: '', sellingPrice: '',
  wholesalePrice: '', minSellingPrice: '', gstRate: '', hsnCode: '',
  cessRate: '0', taxInclusive: false, openingStock: '0',
  measureType: '', unitSymbol: '', unitSize: '', gstUqc: '', isLoose: false,
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
    measureType: '', unitSymbol: '', unitSize: '', gstUqc: '', isLoose: false,
  });

  const [deactivatingId, setDeactivatingId]   = useState<string | null>(null);
  const [togglingOnlineId, setTogglingOnlineId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  // PLU Bundle (bulk ↔ single)
  const [bundles, setBundles]                   = useState<any[]>([]);
  const [showBundlePanel, setShowBundlePanel]   = useState(false);
  const [bundleForm, setBundleForm]             = useState({ bulkPluId: '', singlePluId: '', conversionQty: '1', type: 'FIXED', bulkWeightG: '', unitWeightG: '', notes: '' });
  const [savingBundle, setSavingBundle]         = useState(false);
  // Single PLU search (cross-product)
  const [singleSearch, setSingleSearch]         = useState('');
  const [singleResults, setSingleResults]       = useState<any[]>([]);
  const [singleSearching, setSingleSearching]   = useState(false);
  const [selectedSinglePlu, setSelectedSinglePlu] = useState<any | null>(null);
  const singleDebounce = React.useRef<any>(null);

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

  function doSingleSearch(q: string) {
    clearTimeout(singleDebounce.current);
    setSingleSearch(q);
    if (!q.trim()) { setSingleResults([]); return; }
    singleDebounce.current = setTimeout(async () => {
      setSingleSearching(true);
      try {
        const res = await api.get(`/repack/search/target?q=${encodeURIComponent(q)}&exclude=${bundleForm.bulkPluId || ''}`);
        setSingleResults(res.data ?? []);
      } catch { setSingleResults([]); }
      finally { setSingleSearching(false); }
    }, 250);
  }

  function closeBundlePanel() {
    setShowBundlePanel(false);
    setBundleForm({ bulkPluId: '', singlePluId: '', conversionQty: '1', type: 'FIXED', bulkWeightG: '', unitWeightG: '', notes: '' });
    setSingleSearch(''); setSingleResults([]); setSelectedSinglePlu(null);
  }

  async function handleSaveBundle() {
    if (!bundleForm.bulkPluId) { toast.error('Select bulk PLU'); return; }
    if (bundleForm.type === 'FIXED') {
      if (!selectedSinglePlu) { toast.error('Search and select the single unit PLU'); return; }
      if (bundleForm.bulkPluId === selectedSinglePlu.id) { toast.error('Bulk and single PLU must be different'); return; }
      const qty = parseInt(bundleForm.conversionQty);
      if (!qty || qty < 1) { toast.error('Conversion qty must be at least 1'); return; }
    } else {
      if (!parseFloat(bundleForm.bulkWeightG)) { toast.error('Enter bulk unit weight in grams'); return; }
    }
    setSavingBundle(true);
    try {
      const payload: any = {
        bulkPluId: bundleForm.bulkPluId,
        singlePluId: selectedSinglePlu?.id ?? bundleForm.singlePluId,
        conversionQty: parseInt(bundleForm.conversionQty) || 1,
        type: bundleForm.type,
        notes: bundleForm.notes || undefined,
      };
      if (bundleForm.type === 'VARIABLE') {
        payload.bulkWeightG = parseFloat(bundleForm.bulkWeightG);
        if (bundleForm.unitWeightG) payload.unitWeightG = parseFloat(bundleForm.unitWeightG);
      }
      await api.post('/products/plu-bundles', payload);
      toast.success('Bundle linked');
      closeBundlePanel();
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
        measureType:    addForm.measureType   || undefined,
        unitSymbol:     addForm.unitSymbol    || undefined,
        unitSize:       addForm.unitSize      ? Number(addForm.unitSize) : undefined,
        baseUnitQty:    (addForm.unitSymbol && addForm.unitSize)
                          ? calcBaseUnitQty(addForm.unitSymbol, Number(addForm.unitSize))
                          : undefined,
        gstUqc:         addForm.gstUqc        || undefined,
        isLoose:        addForm.isLoose       || undefined,
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
        measureType:     editForm.measureType  || null,
        unitSymbol:      editForm.unitSymbol   || null,
        unitSize:        editForm.unitSize     ? Number(editForm.unitSize)  : null,
        baseUnitQty:     (editForm.unitSymbol && editForm.unitSize)
                           ? calcBaseUnitQty(editForm.unitSymbol, Number(editForm.unitSize))
                           : null,
        gstUqc:          editForm.gstUqc       || null,
        isLoose:         editForm.isLoose,
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
      measureType:     plu.measureType ?? '',
      unitSymbol:      plu.unitSymbol  ?? '',
      unitSize:        plu.unitSize    != null ? String(Number(plu.unitSize)) : '',
      gstUqc:          plu.gstUqc      ?? '',
      isLoose:         plu.isLoose     ?? false,
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
                            {plu.unitSymbol && plu.unitSize != null && (
                              <div className="text-[10px] text-indigo-600 mt-0.5 font-medium">
                                {Number(plu.unitSize)}{plu.unitSymbol}{plu.isLoose ? ' · loose' : ''}
                              </div>
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

                                {/* Row 3: UOM */}
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                                  <div>
                                    <label className="text-[11px] font-medium text-gray-500 block mb-1">Measure Type</label>
                                    <select value={editForm.measureType}
                                      onChange={e => setEditForm(f => ({ ...f, measureType: e.target.value, unitSymbol: '', unitSize: '', gstUqc: '' }))}
                                      className="inp text-xs">
                                      <option value="">— none —</option>
                                      <option value="WEIGHT">Weight</option>
                                      <option value="VOLUME">Volume</option>
                                      <option value="COUNT">Count</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[11px] font-medium text-gray-500 block mb-1">Unit</label>
                                    <select value={editForm.unitSymbol}
                                      onChange={e => setEditForm(f => ({ ...f, unitSymbol: e.target.value, gstUqc: UQC_MAP[e.target.value] ?? f.gstUqc }))}
                                      className="inp text-xs" disabled={!editForm.measureType}>
                                      <option value="">—</option>
                                      {(UNIT_SYMBOLS[editForm.measureType] ?? []).map(s => (
                                        <option key={s} value={s}>{s}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[11px] font-medium text-gray-500 block mb-1">
                                      Size{editForm.unitSymbol ? ` (${editForm.unitSymbol})` : ''}
                                    </label>
                                    <input type="number" min="0" step="any" value={editForm.unitSize}
                                      onChange={e => setEditForm(f => ({ ...f, unitSize: e.target.value }))}
                                      className="inp text-xs" placeholder="e.g. 50" disabled={!editForm.unitSymbol} />
                                  </div>
                                  <div>
                                    <label className="text-[11px] font-medium text-gray-500 block mb-1">GST UQC</label>
                                    <select value={editForm.gstUqc}
                                      onChange={e => setEditForm(f => ({ ...f, gstUqc: e.target.value }))}
                                      className="inp text-xs">
                                      <option value="">—</option>
                                      {['KGS','GMS','LTR','MLT','NOS','PCS','CTN','BOX','BTL','BAG','PAC','DOZ','OTH'].map(u => (
                                        <option key={u} value={u}>{u}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-medium text-gray-500">Loose / Weigh</label>
                                    <button type="button"
                                      onClick={() => setEditForm(f => ({ ...f, isLoose: !f.isLoose }))}
                                      className={`w-9 h-5 rounded-full transition-colors relative self-start ${editForm.isLoose ? 'bg-amber-500' : 'bg-gray-300'}`}>
                                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editForm.isLoose ? 'translate-x-4' : ''}`} />
                                    </button>
                                    {editForm.unitSymbol && editForm.unitSize && Number(editForm.unitSize) > 0 && (
                                      <span className="text-[10px] text-blue-600">
                                        {fmtBaseQty(editForm.unitSymbol, calcBaseUnitQty(editForm.unitSymbol, Number(editForm.unitSize)))}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Row 4: toggles + online price */}
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

                                {/* Row 5: save/cancel */}
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
                    <a href="/dashboard/inventory/break-bulk"
                      className="flex items-center gap-1 text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600">
                      <Scissors className="w-3 h-3" /> Break Bulk
                    </a>
                    <button onClick={() => handleDeleteBundle(b.id)}
                      className="text-gray-300 hover:text-red-500 p-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Repack sessions are managed on the dedicated Break Bulk page */}
        </div>

      </main>

      {/* ── Link PLU Bundle Panel ── */}
      {showBundlePanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={closeBundlePanel} />
          <div className="w-full max-w-sm bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#1B4F8A]" /> Set Up Break Bulk
              </h2>
              <button onClick={closeBundlePanel} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 p-5 space-y-4 overflow-y-auto">

              {/* Step 1: Type */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Step 1 — Break Type</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setBundleForm(f => ({ ...f, type: 'FIXED', bulkWeightG: '', unitWeightG: '' })); setSelectedSinglePlu(null); setSingleSearch(''); setSingleResults([]); }}
                    className={`p-3 rounded-xl border-2 text-left transition-colors ${bundleForm.type === 'FIXED' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="text-sm font-bold text-gray-800">📦 Fixed</div>
                    <div className="text-xs text-gray-500 mt-0.5">1 carton = always same units</div>
                    <div className="text-xs text-blue-600 mt-1 font-medium">e.g. 1 box = 12 bottles</div>
                  </button>
                  <button
                    onClick={() => { setBundleForm(f => ({ ...f, type: 'VARIABLE', conversionQty: '1' })); setSelectedSinglePlu(null); setSingleSearch(''); setSingleResults([]); }}
                    className={`p-3 rounded-xl border-2 text-left transition-colors ${bundleForm.type === 'VARIABLE' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="text-sm font-bold text-gray-800">⚖️ Variable</div>
                    <div className="text-xs text-gray-500 mt-0.5">Split by weight at repack</div>
                    <div className="text-xs text-amber-600 mt-1 font-medium">e.g. 50kg bag → any mix</div>
                  </button>
                </div>
              </div>

              {/* Step 2: Bulk PLU */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Step 2 — Bulk Item (this product)</p>
                <select value={bundleForm.bulkPluId} onChange={e => setBundleForm(f => ({ ...f, bulkPluId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]">
                  <option value="">— Select which PLU is the bulk unit —</option>
                  {activePlus.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.displayName ?? p.pluCode} — ₹{p.mrp} · stock: {Number(p.stockOnHand).toFixed(0)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 3: Type-specific fields */}
              {bundleForm.type === 'FIXED' ? (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Step 3 — Conversion</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 whitespace-nowrap">1 bulk =</span>
                    <input type="number" min="1" value={bundleForm.conversionQty}
                      onChange={e => setBundleForm(f => ({ ...f, conversionQty: e.target.value }))}
                      className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center font-mono focus:outline-none focus:border-[#1B4F8A]" />
                    <span className="text-sm text-gray-600 whitespace-nowrap">single units</span>
                  </div>
                  {bundleForm.conversionQty && parseInt(bundleForm.conversionQty) > 1 && (
                    <p className="text-xs text-blue-600 mt-1">✓ Each time you break 1 bulk unit, {bundleForm.conversionQty} singles will be added to stock</p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Step 3 — Weights</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Total weight of bulk unit *</label>
                      <div className="relative">
                        <input type="number" min="1" value={bundleForm.bulkWeightG}
                          onChange={e => setBundleForm(f => ({ ...f, bulkWeightG: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:border-[#1B4F8A]"
                          placeholder="e.g. 50000" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">g</span>
                      </div>
                      {bundleForm.bulkWeightG && <p className="text-xs text-gray-400 mt-0.5">= {(parseFloat(bundleForm.bulkWeightG)/1000).toFixed(2)} kg</p>}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Default pack size (optional)</label>
                      <div className="relative">
                        <input type="number" min="1" value={bundleForm.unitWeightG}
                          onChange={e => setBundleForm(f => ({ ...f, unitWeightG: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:border-[#1B4F8A]"
                          placeholder="e.g. 1000" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">g</span>
                      </div>
                      {bundleForm.unitWeightG && bundleForm.bulkWeightG && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Max {Math.floor(parseFloat(bundleForm.bulkWeightG)/parseFloat(bundleForm.unitWeightG))} packs
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Single PLU — cross-product search */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Step 4 — {bundleForm.type === 'FIXED' ? 'Single Unit PLU *' : 'Default Output PLU (optional)'}
                </p>
                {bundleForm.type === 'VARIABLE' && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                    At repack time you choose the actual output — this is just the default suggestion. You can skip this.
                  </p>
                )}
                {selectedSinglePlu ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-green-900">{selectedSinglePlu.product?.name ?? selectedSinglePlu.displayName ?? selectedSinglePlu.pluCode}</p>
                      <p className="text-xs text-green-600 mt-0.5">{selectedSinglePlu.displayName ?? selectedSinglePlu.pluCode} · Stock: {Number(selectedSinglePlu.stockOnHand).toFixed(0)}</p>
                    </div>
                    <button onClick={() => { setSelectedSinglePlu(null); setSingleSearch(''); setSingleResults([]); }}
                      className="text-green-400 hover:text-green-700 ml-2"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={singleSearch}
                      onChange={e => doSingleSearch(e.target.value)}
                      placeholder="Search across all products…"
                      disabled={!bundleForm.bulkPluId}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#1B4F8A] disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    {!bundleForm.bulkPluId && (
                      <p className="text-xs text-gray-400 mt-1">Select the bulk PLU first (Step 2)</p>
                    )}
                    {singleSearch && (
                      <div className="absolute z-20 left-0 right-0 mt-1 border border-gray-200 rounded-lg bg-white shadow-lg divide-y max-h-44 overflow-y-auto">
                        {singleSearching && <p className="p-3 text-sm text-gray-400">Searching…</p>}
                        {!singleSearching && singleResults.length === 0 && singleSearch.length > 0 && (
                          <p className="p-3 text-sm text-gray-400">No PLUs found — try product name or PLU code</p>
                        )}
                        {singleResults.map((r: any) => (
                          <button key={r.id}
                            onClick={() => { setSelectedSinglePlu(r); setBundleForm(f => ({ ...f, singlePluId: r.id })); setSingleSearch(''); setSingleResults([]); }}
                            className="w-full text-left px-3 py-2.5 hover:bg-gray-50">
                            <p className="text-sm font-medium text-gray-900">{r.product?.name ?? r.displayName ?? r.pluCode}</p>
                            <p className="text-xs text-gray-500">{r.displayName ?? r.pluCode} · ₹{r.mrp ?? '—'} · stock: {Number(r.stockOnHand).toFixed(0)}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Notes (optional)</label>
                <input value={bundleForm.notes} onChange={e => setBundleForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder={bundleForm.type === 'FIXED' ? 'e.g. 1 carton = 12 dozen packs' : 'e.g. 50kg sugar bag, variable packing'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]" />
              </div>

              {/* Preview */}
              {bundleForm.bulkPluId && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-xs space-y-1">
                  <p className="font-semibold text-gray-600">Preview</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-mono">
                      {activePlus.find(p => p.id === bundleForm.bulkPluId)?.displayName ?? activePlus.find(p => p.id === bundleForm.bulkPluId)?.pluCode ?? '?'}
                    </span>
                    <span className="text-gray-400">→</span>
                    {bundleForm.type === 'FIXED' ? (
                      <>
                        <span className="font-bold text-gray-700">{bundleForm.conversionQty || '?'} ×</span>
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-mono">
                          {selectedSinglePlu ? (selectedSinglePlu.displayName ?? selectedSinglePlu.pluCode) : '— select single —'}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-500 italic">
                        {bundleForm.bulkWeightG ? `${(parseFloat(bundleForm.bulkWeightG)/1000).toFixed(2)}kg` : '? kg'} · split at repack time
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={closeBundlePanel}
                className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveBundle} disabled={savingBundle}
                className="flex-1 py-2.5 text-sm bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163d6d] disabled:opacity-60 font-medium">
                {savingBundle ? 'Saving…' : 'Save & Link'}
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
              {/* UOM Section */}
              <div className="border border-gray-200 rounded-xl p-3 space-y-2.5">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Unit of Measurement</p>
                <div className="grid grid-cols-2 gap-3">
                  <PluFld label="Measure Type">
                    <select
                      value={addForm.measureType}
                      onChange={e => setAddForm(f => {
                        const mt = e.target.value;
                        return { ...f, measureType: mt, unitSymbol: '', unitSize: '', gstUqc: '' };
                      })}
                      className="inp"
                    >
                      <option value="">— optional —</option>
                      <option value="WEIGHT">Weight (kg / g)</option>
                      <option value="VOLUME">Volume (L / ml)</option>
                      <option value="COUNT">Count (pcs / ctn / box…)</option>
                    </select>
                  </PluFld>
                  <PluFld label="Unit Symbol">
                    <select
                      value={addForm.unitSymbol}
                      onChange={e => setAddForm(f => ({
                        ...f, unitSymbol: e.target.value,
                        gstUqc: UQC_MAP[e.target.value] ?? f.gstUqc,
                      }))}
                      className="inp"
                      disabled={!addForm.measureType}
                    >
                      <option value="">— select —</option>
                      {(UNIT_SYMBOLS[addForm.measureType] ?? []).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </PluFld>
                </div>
                {addForm.unitSymbol && (
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <PluFld label={`Pack size (in ${addForm.unitSymbol})`}>
                      <input type="number" min="0" step="any"
                        value={addForm.unitSize}
                        onChange={e => setAddForm(f => ({ ...f, unitSize: e.target.value }))}
                        className="inp" placeholder={addForm.unitSymbol === 'kg' ? 'e.g. 50' : 'e.g. 500'} />
                    </PluFld>
                    <div className="pb-0.5">
                      {addForm.unitSize && Number(addForm.unitSize) > 0 ? (
                        <div className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2 font-medium">
                          = {fmtBaseQty(addForm.unitSymbol, calcBaseUnitQty(addForm.unitSymbol, Number(addForm.unitSize)))} stored
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">Enter size to see base qty</div>
                      )}
                    </div>
                  </div>
                )}
                {addForm.unitSymbol && (
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <PluFld label="GST UQC (auto-filled)">
                      <select
                        value={addForm.gstUqc}
                        onChange={e => setAddForm(f => ({ ...f, gstUqc: e.target.value }))}
                        className="inp"
                      >
                        <option value="">— select —</option>
                        {['KGS','GMS','LTR','MLT','NOS','PCS','CTN','BOX','BTL','BAG','PAC','DOZ','OTH'].map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </PluFld>
                    <label className="flex items-center gap-2 cursor-pointer pt-4">
                      <button type="button"
                        onClick={() => setAddForm(f => ({ ...f, isLoose: !f.isLoose }))}
                        className={`w-9 h-5 rounded-full transition-colors relative ${addForm.isLoose ? 'bg-amber-500' : 'bg-gray-300'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${addForm.isLoose ? 'translate-x-4' : ''}`} />
                      </button>
                      <span className="text-xs text-gray-600">Loose / Weigh</span>
                    </label>
                  </div>
                )}
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
