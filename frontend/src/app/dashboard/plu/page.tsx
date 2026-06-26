'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useRouter } from 'next/navigation';
import {
  Search, Download, ChevronRight, Loader2, X, Check,
  AlertCircle, ChevronDown, Edit2, Plus, Star, Barcode,
} from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { useWebSocket } from '@/providers/WebSocketProvider';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { canViewCost } from '@/lib/cost-visibility';
import { BarcodeScannerInput } from '@/components/shared/BarcodeScannerInput';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DefaultPlu {
  id: string;
  pluCode: string;
  eanCode?: string;
  basicCost?: number;
  costPrice?: number;
  mrp: number;
  sellingPrice: number;
  wholesalePrice?: number;
  minSellingPrice?: number;
  gstRate?: number;
  cessRate?: number;
  taxInclusive: boolean;
  stockOnHand: number;
  availableOnline: boolean;
  onlinePrice?: number | null;
  displayName?: string | null;
}

interface ProductRow {
  id: string;
  name: string;
  shortName?: string;
  productCode: string;
  unitOfMeasure: string;
  isActive: boolean;
  activePluCount: number;
  defaultPlu: DefaultPlu | null;
  department?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
  departmentId?: string;
}

interface Department {
  id: string;
  name: string;
}

type EditableField = 'sellingPrice' | 'wholesalePrice' | 'minSellingPrice' | 'gstRate';

interface EditingCell {
  productId: string;
  pluId: string;
  field: EditableField;
  value: string;
}

type BulkAction = 'gstRate' | 'discount' | 'margin' | 'activate' | 'deactivate' | null;

interface FullPlu {
  id: string; pluCode: string; eanCode: string | null;
  costPrice: number | null; basicCost: number | null;
  mrp: number; sellingPrice: number; wholesalePrice: number | null;
  minSellingPrice: number | null; gstRate: number; cessRate: number;
  stockOnHand: number; isDefault: boolean; isActive: boolean; isArchived: boolean;
  displayName: string | null; availableOnline: boolean; onlinePrice: number | null;
  createdAt: string;
}

const GST_RATES = [0, 3, 5, 12, 18, 28];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function r2(n: number) { return Math.round(n * 100) / 100; }

function margin(mrp: number, cost: number): string {
  if (!mrp || !cost) return '—';
  const pct = ((Number(mrp) - Number(cost)) / Number(mrp)) * 100;
  return Number(pct ?? 0).toFixed(1) + '%';
}

function fmt(n?: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function exportCsv(rows: ProductRow[], showCost: boolean) {
  const headers = showCost
    ? ['Product', 'Code', 'PLU Code', 'EAN', 'Cost Price', 'MRP', 'Sale Price', 'Wholesale', 'GST%', 'Margin%', 'Stock', 'Status']
    : ['Product', 'Code', 'PLU Code', 'EAN', 'MRP', 'Sale Price', 'Wholesale', 'GST%', 'Stock', 'Status'];
  const lines = rows.map((r) => {
    const p = r.defaultPlu;
    if (!p) {
      return showCost
        ? [r.name, r.productCode, '', '', '', '', '', '', '', '', '0', r.isActive ? 'Active' : 'Inactive']
        : [r.name, r.productCode, '', '', '', '', '', '', '0', r.isActive ? 'Active' : 'Inactive'];
    }
    const mgn = showCost && p.mrp && p.costPrice ? r2(((Number(p.mrp) - Number(p.costPrice)) / Number(p.mrp)) * 100) : '';
    return showCost
      ? [r.name, r.productCode, p.pluCode, p.eanCode ?? '', p.costPrice ?? '', p.mrp, p.sellingPrice, p.wholesalePrice ?? '', p.gstRate ?? '', mgn, p.stockOnHand, r.isActive ? 'Active' : 'Inactive']
      : [r.name, r.productCode, p.pluCode, p.eanCode ?? '', p.mrp, p.sellingPrice, p.wholesalePrice ?? '', p.gstRate ?? '', p.stockOnHand, r.isActive ? 'Active' : 'Inactive'];
  });
  const csv = [headers, ...lines].map((l) => l.map((v) => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'plu-list.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ─── SortTh ──────────────────────────────────────────────────────────────────

function SortTh({ col, label, sortBy, sortDir, onSort }: {
  col: string; label: string; sortBy: string; sortDir: 'asc'|'desc'; onSort: (col: string) => void;
}) {
  const active = sortBy === col;
  return (
    <button onClick={() => onSort(col)} className={`flex items-center gap-0.5 hover:text-blue-600 transition-colors ${active ? 'text-blue-600' : ''}`}>
      {label}
      <span className="text-xs">{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PluManagementPage() {
  const router = useRouter();

  const showCost = canViewCost(getUser<{ role: string }>()?.role);

  // Filters
  const [search, setSearch]         = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterCat, setFilterCat]   = useState('');
  const [filterSubCat, setFilterSubCat] = useState('');
  const [filterGst, setFilterGst]   = useState('');
  const [filterStock, setFilterStock] = useState('');       // '' | 'IN' | 'LOW' | 'OUT'
  const [filterOnline, setFilterOnline] = useState('');     // '' | 'ONLINE' | 'OFFLINE'
  const [filterPlu, setFilterPlu]   = useState('');         // '' | 'HAS' | 'NONE'
  const [filterEan, setFilterEan]   = useState('');         // '' | 'HAS' | 'MISSING'
  const [priceMin, setPriceMin]     = useState('');
  const [priceMax, setPriceMax]     = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sorting
  const [sortBy, setSortBy]         = useState('name');     // name|code|sellingPrice|mrp|stock|margin|gstRate
  const [sortDir, setSortDir]       = useState<'asc'|'desc'>('asc');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Inline editing
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const editInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  const [togglingOnlineId, setTogglingOnlineId] = useState<string | null>(null);
  const [editingPackLabel, setEditingPackLabel] = useState<{ productId: string; pluId: string; value: string } | null>(null);

  // Bulk action dialog
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [bulkValue, setBulkValue] = useState('');

  // PLU detail panel
  const [panelProduct, setPanelProduct] = useState<ProductRow | null>(null);
  const [panelPlus, setPanelPlus] = useState<FullPlu[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [editingEan, setEditingEan] = useState<{ pluId: string; value: string } | null>(null);
  const [savingEan, setSavingEan] = useState(false);
  const [panelEditField, setPanelEditField] = useState<{ pluId: string; field: string; value: string } | null>(null);

  useEscapeKey(() => { if (panelProduct) setPanelProduct(null); else setBulkAction(null); }, !!bulkAction || !!panelProduct);

  // ─── Data ──────────────────────────────────────────────────────────────────

  const queryClient = useQueryClient();
  const { connected } = useWebSocket();

  const { data: pluData, isLoading, isError, refetch } = useQuery({
    queryKey: ['plus'],
    queryFn: async () => {
      const [prodRes, catRes] = await Promise.all([
        api.get('/products?limit=1000&includeInactive=true'),
        api.get('/products/categories/flat'),
      ]);
      const products: ProductRow[] = prodRes.data?.data ?? prodRes.data ?? [];
      const categories: Category[] = catRes.data ?? [];
      const deptMap = new Map<string, Department>();
      products.forEach((p) => { if (p.department) deptMap.set(p.department.id, p.department); });
      return { products, categories, departments: Array.from(deptMap.values()) };
    },
  });

  const products    = (pluData?.products    ?? []) as ProductRow[];
  const categories  = (pluData?.categories  ?? []) as Category[];
  const departments = (pluData?.departments ?? []) as Department[];

  // ─── Search debounce ───────────────────────────────────────────────────────

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (editing && editInputRef.current) editInputRef.current.focus();
  }, [editing]);

  // ─── WebSocket live updates ────────────────────────────────────────────────

  useWebSocketEvent('plu.created',     () => queryClient.invalidateQueries({ queryKey: ['plus'] }));
  useWebSocketEvent('plu.updated',     () => queryClient.invalidateQueries({ queryKey: ['plus'] }));
  useWebSocketEvent('plu.archived',    () => queryClient.invalidateQueries({ queryKey: ['plus'] }));
  useWebSocketEvent('product.updated', () => queryClient.invalidateQueries({ queryKey: ['plus'] }));

  // ─── Mutations ────────────────────────────────────────────────────────────

  const editMutation = useMutation({
    mutationFn: async ({ productId, pluId, field, value }: { productId: string; pluId: string; field: EditableField; value: number }) => {
      await api.patch(`/products/${productId}/plus/${pluId}`, { [field]: value });
    },
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['plus'] });
    },
    onError: () => { setEditing(null); },
  });

  const onlineToggleMutation = useMutation({
    mutationFn: async ({ productId, pluId, availableOnline }: { productId: string; pluId: string; availableOnline: boolean }) => {
      await api.patch(`/products/${productId}/plus/${pluId}`, { availableOnline });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plus'] });
    },
    onSettled: () => setTogglingOnlineId(null),
  });

  const packLabelMutation = useMutation({
    mutationFn: async ({ productId, pluId, packLabel }: { productId: string; pluId: string; packLabel: string | null }) => {
      await api.patch(`/products/${productId}/plus/${pluId}`, { packLabel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plus'] });
      setEditingPackLabel(null);
    },
    onError: () => setEditingPackLabel(null),
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ action, targets, value }: { action: NonNullable<BulkAction>; targets: ProductRow[]; value: string }) => {
      if (action === 'activate' || action === 'deactivate') {
        const apiAction = action === 'activate' ? 'ENABLE' : 'DISABLE';
        await Promise.all(targets.map((p) => api.put(`/products/${p.id}/toggle-status`, { action: apiAction })));
      } else if (action === 'gstRate') {
        const rate = parseFloat(value);
        if (isNaN(rate)) throw new Error('Invalid rate');
        await Promise.all(targets.map((p) => api.patch(`/products/${p.id}/plus/${p.defaultPlu!.id}`, { gstRate: rate })));
      } else if (action === 'discount') {
        const pct = parseFloat(value);
        if (isNaN(pct) || pct < 0 || pct >= 100) throw new Error('Invalid discount');
        await Promise.all(targets.map((p) => {
          const newPrice = r2(Number(p.defaultPlu!.sellingPrice) * (1 - pct / 100));
          return api.patch(`/products/${p.id}/plus/${p.defaultPlu!.id}`, { sellingPrice: newPrice });
        }));
      } else if (action === 'margin') {
        const pct = parseFloat(value);
        if (isNaN(pct) || pct <= 0 || pct >= 100) throw new Error('Invalid margin');
        await Promise.all(
          targets.filter((p) => p.defaultPlu!.costPrice != null).map((p) => {
            const newPrice = r2(p.defaultPlu!.costPrice! / (1 - pct / 100));
            return api.patch(`/products/${p.id}/plus/${p.defaultPlu!.id}`, { sellingPrice: newPrice });
          })
        );
      }
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      setBulkAction(null);
      setBulkValue('');
      queryClient.invalidateQueries({ queryKey: ['plus'] });
    },
    onError: () => { setBulkAction(null); setBulkValue(''); },
  });

  // ─── Filtered + sorted rows ────────────────────────────────────────────────

  // Categories = parent cats (no parentId); SubCats = have parentId
  const parentCats = categories.filter((c) => !(c as any).parentId);
  const subCats    = categories.filter((c) => !!(c as any).parentId);

  const filteredCategories = filterDept
    ? parentCats.filter((c) => c.departmentId === filterDept)
    : parentCats;

  const filteredSubCats = filterCat
    ? subCats.filter((c) => (c as any).parent?.id === filterCat || (c as any).parentId === filterCat)
    : filterDept
    ? subCats.filter((c) => c.departmentId === filterDept)
    : subCats;

  const activeFilterCount = [
    filterDept, filterCat, filterSubCat, filterGst,
    filterStock, filterOnline, filterPlu, filterEan,
    priceMin, priceMax, !activeOnly ? 'inactive' : '',
  ].filter(Boolean).length;

  function clearAll() {
    setFilterDept(''); setFilterCat(''); setFilterSubCat('');
    setFilterGst(''); setFilterStock(''); setFilterOnline('');
    setFilterPlu(''); setFilterEan('');
    setPriceMin(''); setPriceMax('');
    setActiveOnly(true); setSearch('');
  }

  const filtered = useMemo(() => {
    let rows = products.filter((p) => {
      if (activeOnly && !p.isActive) return false;
      if (filterDept && p.department?.id !== filterDept) return false;

      // Category filter: if filterSubCat is set use it, else use filterCat
      if (filterSubCat) {
        if (p.category?.id !== filterSubCat) return false;
      } else if (filterCat) {
        // filterCat is a parent cat; product.category is a subcategory
        // match if product's category parentId = filterCat (via flat list lookup)
        const subCatObj = subCats.find(sc => sc.id === p.category?.id);
        if (!subCatObj || (subCatObj as any).parentId !== filterCat) return false;
      }

      if (filterGst) {
        const rate = p.defaultPlu?.gstRate ?? 0;
        if (String(rate) !== filterGst) return false;
      }

      if (filterPlu === 'HAS'  && (!p.defaultPlu || p.activePluCount === 0)) return false;
      if (filterPlu === 'NONE' && p.activePluCount > 0) return false;

      if (filterEan === 'HAS'     && !p.defaultPlu?.eanCode) return false;
      if (filterEan === 'MISSING' && !!p.defaultPlu?.eanCode) return false;

      if (filterOnline === 'ONLINE'  && !p.defaultPlu?.availableOnline) return false;
      if (filterOnline === 'OFFLINE' && p.defaultPlu?.availableOnline) return false;

      if (filterStock) {
        const stock = p.defaultPlu?.stockOnHand ?? 0;
        const reorder = 10; // default — product doesn't expose reorderLevel here
        if (filterStock === 'IN'  && stock <= 0) return false;
        if (filterStock === 'OUT' && stock > 0) return false;
        if (filterStock === 'LOW' && (stock <= 0 || stock > reorder)) return false;
      }

      if (priceMin !== '' && (p.defaultPlu?.sellingPrice ?? 0) < parseFloat(priceMin)) return false;
      if (priceMax !== '' && (p.defaultPlu?.sellingPrice ?? 0) > parseFloat(priceMax)) return false;

      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.productCode.toLowerCase().includes(q) &&
          !(p.defaultPlu?.pluCode ?? '').toLowerCase().includes(q) &&
          !(p.defaultPlu?.eanCode ?? '').toLowerCase().includes(q) &&
          !(p.category?.name ?? '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });

    // ── Sort ──
    rows = [...rows].sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      switch (sortBy) {
        case 'name':         va = a.name;                              vb = b.name; break;
        case 'code':         va = a.productCode;                      vb = b.productCode; break;
        case 'sellingPrice': va = a.defaultPlu?.sellingPrice ?? 0;    vb = b.defaultPlu?.sellingPrice ?? 0; break;
        case 'mrp':          va = a.defaultPlu?.mrp ?? 0;             vb = b.defaultPlu?.mrp ?? 0; break;
        case 'stock':        va = a.defaultPlu?.stockOnHand ?? 0;     vb = b.defaultPlu?.stockOnHand ?? 0; break;
        case 'gstRate':      va = a.defaultPlu?.gstRate ?? 0;         vb = b.defaultPlu?.gstRate ?? 0; break;
        case 'margin':
          va = (a.defaultPlu?.mrp && a.defaultPlu?.costPrice)
            ? ((Number(a.defaultPlu.mrp) - Number(a.defaultPlu.costPrice)) / Number(a.defaultPlu.mrp)) * 100 : -1;
          vb = (b.defaultPlu?.mrp && b.defaultPlu?.costPrice)
            ? ((Number(b.defaultPlu.mrp) - Number(b.defaultPlu.costPrice)) / Number(b.defaultPlu.mrp)) * 100 : -1;
          break;
        case 'costPrice':    va = a.defaultPlu?.costPrice ?? 0;       vb = b.defaultPlu?.costPrice ?? 0; break;
      }
      if (typeof va === 'string') {
        const cmp = va.localeCompare(vb as string);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

    return rows;
  }, [products, activeOnly, filterDept, filterCat, filterSubCat, filterGst, filterPlu,
      filterEan, filterOnline, filterStock, priceMin, priceMax, debouncedSearch,
      sortBy, sortDir, subCats]);

  // ─── Selection helpers ─────────────────────────────────────────────────────

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ─── Inline edit ───────────────────────────────────────────────────────────

  function startEdit(p: ProductRow, field: EditableField) {
    if (!p.defaultPlu) return;
    const raw = field === 'gstRate'
      ? String(p.defaultPlu.gstRate ?? 0)
      : String(p.defaultPlu[field] ?? '');
    setEditing({ productId: p.id, pluId: p.defaultPlu.id, field, value: raw });
  }

  function commitEdit() {
    if (!editing || editMutation.isPending) return;
    const num = parseFloat(editing.value);
    if (isNaN(num) || num < 0) { setEditing(null); return; }
    editMutation.mutate({ productId: editing.productId, pluId: editing.pluId, field: editing.field, value: r2(num) });
  }

  function cancelEdit() { setEditing(null); }

  // ─── Bulk save ─────────────────────────────────────────────────────────────

  function runBulkAction() {
    if (!bulkAction || bulkMutation.isPending) return;
    const targets = filtered.filter((p) => selectedIds.has(p.id) && p.defaultPlu);
    bulkMutation.mutate({ action: bulkAction, targets, value: bulkValue });
  }

  // ─── Panel helpers ────────────────────────────────────────────────────────

  const openPanel = useCallback(async (p: ProductRow) => {
    setPanelProduct(p);
    setPanelLoading(true);
    try {
      const res = await api.get(`/products/${p.id}/plus`);
      setPanelPlus(res.data ?? []);
    } catch { setPanelPlus([]); }
    finally { setPanelLoading(false); }
  }, []);

  async function saveEan(productId: string, pluId: string, ean: string) {
    setSavingEan(true);
    try {
      await api.patch(`/products/${productId}/plus/${pluId}`, { eanCode: ean.trim() || null });
      setEditingEan(null);
      queryClient.invalidateQueries({ queryKey: ['plus'] });
      // Refresh panel
      if (panelProduct?.id === productId) {
        const res = await api.get(`/products/${productId}/plus`);
        setPanelPlus(res.data ?? []);
      }
    } catch { /* keep editing open */ }
    finally { setSavingEan(false); }
  }

  async function savePanelField(productId: string, pluId: string, field: string, value: number) {
    try {
      await api.patch(`/products/${productId}/plus/${pluId}`, { [field]: value });
      queryClient.invalidateQueries({ queryKey: ['plus'] });
      const res = await api.get(`/products/${productId}/plus`);
      setPanelPlus(res.data ?? []);
      setPanelEditField(null);
    } catch {}
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-gray-600">Failed to load products.</p>
        <button onClick={() => refetch()} className="text-sm text-blue-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">PLU Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {filtered.length !== products.length
              ? <><span className="font-semibold text-blue-600">{filtered.length}</span> of {products.length} products</>
              : <>{filtered.length} products</>
            }
            {' · '}Sorted by <span className="font-medium">{sortBy}</span> {sortDir === 'asc' ? '↑' : '↓'}
            {' · '}Click a price cell to edit inline
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${connected ? 'text-green-600' : 'text-gray-400'}`}>
            {connected ? '● Live' : '○ Offline'}
          </span>
          <button
            onClick={() => exportCsv(filtered, showCost)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="border-b border-gray-100 bg-gray-50 shrink-0">
        {/* Row 1: Search + main filters + sort */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-3">
          <BarcodeScannerInput
            value={search} onChange={setSearch}
            placeholder="Search name / code / PLU / EAN or scan barcode…"
            className="flex-1 min-w-52"
            inputClassName="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500"
          />

          <select value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setFilterCat(''); setFilterSubCat(''); }}
            className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:border-blue-500 min-w-36">
            <option value="">All Depts</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          <select value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setFilterSubCat(''); }}
            className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:border-blue-500 min-w-36"
            disabled={filteredCategories.length === 0}>
            <option value="">All Categories</option>
            {filteredCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select value={filterSubCat} onChange={(e) => setFilterSubCat(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:border-blue-500 min-w-36"
            disabled={filteredSubCats.length === 0}>
            <option value="">All Sub-cats</option>
            {filteredSubCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Sort */}
          <div className="flex items-center gap-1 ml-auto">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:border-blue-500">
              <option value="name">Name</option>
              <option value="code">Code</option>
              <option value="sellingPrice">Sale Price</option>
              <option value="mrp">MRP</option>
              <option value="stock">Stock</option>
              <option value="gstRate">GST %</option>
              {showCost && <option value="margin">Margin %</option>}
              {showCost && <option value="costPrice">Cost Price</option>}
            </select>
            <button
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-white hover:bg-gray-100 font-mono"
              title={sortDir === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className={`flex items-center gap-1 text-sm px-2.5 py-2 rounded-lg border transition-colors ${
              showAdvanced || activeFilterCount > 0
                ? 'border-blue-400 text-blue-600 bg-blue-50'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>

          {activeFilterCount > 0 && (
            <button onClick={clearAll} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700">
              <X className="w-3.5 h-3.5" /> Clear all
            </button>
          )}
        </div>

        {/* Row 2: Advanced filters (collapsible) */}
        {showAdvanced && (
          <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
            {/* GST Rate */}
            <select value={filterGst} onChange={(e) => setFilterGst(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-500">
              <option value="">All GST %</option>
              {GST_RATES.map((r) => <option key={r} value={String(r)}>GST {r}%</option>)}
            </select>

            {/* Stock status */}
            <select value={filterStock} onChange={(e) => setFilterStock(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-500">
              <option value="">All Stock</option>
              <option value="IN">In Stock</option>
              <option value="LOW">Low Stock</option>
              <option value="OUT">Out of Stock</option>
            </select>

            {/* Online status */}
            <select value={filterOnline} onChange={(e) => setFilterOnline(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-500">
              <option value="">All Online</option>
              <option value="ONLINE">Online ✓</option>
              <option value="OFFLINE">Offline</option>
            </select>

            {/* PLU status */}
            <select value={filterPlu} onChange={(e) => setFilterPlu(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-500">
              <option value="">All PLU</option>
              <option value="HAS">Has PLU</option>
              <option value="NONE">No PLU</option>
            </select>

            {/* EAN status */}
            <select value={filterEan} onChange={(e) => setFilterEan(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-500">
              <option value="">All EAN</option>
              <option value="HAS">Has EAN</option>
              <option value="MISSING">Missing EAN</option>
            </select>

            {/* Price range */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Price ₹</span>
              <input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)}
                placeholder="Min" className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-500" />
              <span className="text-gray-400">–</span>
              <input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)}
                placeholder="Max" className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-500" />
            </div>

            {/* Active only */}
            <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)}
                className="w-3.5 h-3.5 accent-blue-600" />
              Active only
            </label>
          </div>
        )}
      </div>

      {/* ── Bulk actions bar ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-6 py-2.5 bg-blue-50 border-b border-blue-100 shrink-0">
          <span className="text-sm font-medium text-blue-800">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <button
            onClick={() => setBulkAction('gstRate')}
            className="px-3 py-1.5 text-xs font-medium border border-blue-200 rounded-lg bg-white hover:bg-blue-50 text-blue-700"
          >
            Update GST Rate
          </button>
          <button
            onClick={() => setBulkAction('discount')}
            className="px-3 py-1.5 text-xs font-medium border border-blue-200 rounded-lg bg-white hover:bg-blue-50 text-blue-700"
          >
            Apply Discount %
          </button>
          {showCost && (
            <button
              onClick={() => setBulkAction('margin')}
              className="px-3 py-1.5 text-xs font-medium border border-blue-200 rounded-lg bg-white hover:bg-blue-50 text-blue-700"
            >
              Set Margin %
            </button>
          )}
          <button
            onClick={() => setBulkAction('activate')}
            className="px-3 py-1.5 text-xs font-medium border border-green-200 rounded-lg bg-white hover:bg-green-50 text-green-700"
          >
            Activate
          </button>
          <button
            onClick={() => setBulkAction('deactivate')}
            className="px-3 py-1.5 text-xs font-medium border border-red-200 rounded-lg bg-white hover:bg-red-50 text-red-700"
          >
            Deactivate
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-1 text-blue-400 hover:text-blue-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_0_#e5e7eb]">
            <tr>
              <th className="w-10 px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 accent-blue-600"
                />
              </th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                <SortTh col="name" label="Product" sortBy={sortBy} sortDir={sortDir} onSort={(c) => { if (sortBy===c) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortBy(c); setSortDir('asc'); }}} />
              </th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">PLU / EAN</th>
              {showCost && <th className="px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">
                <SortTh col="costPrice" label="Cost" sortBy={sortBy} sortDir={sortDir} onSort={(c) => { if (sortBy===c) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortBy(c); setSortDir('asc'); }}} />
              </th>}
              <th className="px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">
                <SortTh col="mrp" label="MRP 🔒" sortBy={sortBy} sortDir={sortDir} onSort={(c) => { if (sortBy===c) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortBy(c); setSortDir('asc'); }}} />
              </th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">
                <SortTh col="sellingPrice" label="Sale Price" sortBy={sortBy} sortDir={sortDir} onSort={(c) => { if (sortBy===c) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortBy(c); setSortDir('asc'); }}} />
              </th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">Wholesale</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">Min Sale</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">
                <SortTh col="gstRate" label="GST%" sortBy={sortBy} sortDir={sortDir} onSort={(c) => { if (sortBy===c) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortBy(c); setSortDir('asc'); }}} />
              </th>
              <th className="px-3 py-3 text-center font-semibold text-gray-700 whitespace-nowrap">Online</th>
              {showCost && <th className="px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">
                <SortTh col="margin" label="Margin%" sortBy={sortBy} sortDir={sortDir} onSort={(c) => { if (sortBy===c) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortBy(c); setSortDir('asc'); }}} />
              </th>}
              <th className="px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">
                <SortTh col="stock" label="Stock" sortBy={sortBy} sortDir={sortDir} onSort={(c) => { if (sortBy===c) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortBy(c); setSortDir('asc'); }}} />
              </th>
              <th className="px-3 py-3 text-center font-semibold text-gray-700 whitespace-nowrap">Status</th>
              <th className="w-8 px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={showCost ? 14 : 12} className="px-6 py-12 text-center text-gray-400 text-sm">
                  No products match the current filters.
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const plu = p.defaultPlu;
              const isSelected = selectedIds.has(p.id);

              return (
                <tr
                  key={p.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                >
                  {/* Checkbox */}
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(p.id)}
                      className="w-3.5 h-3.5 accent-blue-600"
                    />
                  </td>

                  {/* Product name — clickable to open detail panel */}
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => openPanel(p)}
                      className="font-medium text-[#1B4F8A] hover:underline leading-snug text-left"
                    >
                      {p.name}
                    </button>
                    <div className="text-xs text-gray-400">{p.productCode} · {p.unitOfMeasure}</div>
                  </td>

                  {/* PLU Code + EAN inline edit */}
                  <td className="px-3 py-2.5">
                    {plu ? (
                      <div className="space-y-0.5">
                        <div className="font-mono text-xs text-gray-700">{plu.pluCode}</div>
                        {editingEan?.pluId === plu.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              value={editingEan.value}
                              onChange={(e) => setEditingEan(el => el ? { ...el, value: e.target.value } : el)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEan(p.id, plu.id, editingEan.value);
                                if (e.key === 'Escape') setEditingEan(null);
                              }}
                              placeholder="EAN barcode"
                              className="w-28 text-xs border border-blue-400 rounded px-1.5 py-0.5 focus:outline-none font-mono"
                              disabled={savingEan}
                            />
                            <button onClick={() => saveEan(p.id, plu.id, editingEan.value)} disabled={savingEan} className="text-green-600"><Check className="w-3 h-3" /></button>
                            <button onClick={() => setEditingEan(null)} className="text-gray-400"><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingEan({ pluId: plu.id, value: plu.eanCode ?? '' })}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 group"
                            title="Edit EAN barcode"
                          >
                            <Barcode className="w-3 h-3" />
                            <span className="font-mono">{plu.eanCode ?? 'add EAN'}</span>
                            <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full border border-red-100">No PLU</span>
                    )}
                  </td>

                  {/* Cost Price (read-only, cost-viewers only) */}
                  {showCost && (
                    <td className="px-3 py-2.5 text-right text-gray-700">
                      {plu ? fmt(plu.costPrice) : '—'}
                    </td>
                  )}

                  {/* MRP (locked) */}
                  <td className="px-3 py-2.5 text-right">
                    <span title="MRP change creates a new PLU. Use the PLU detail page instead." className="text-gray-700 cursor-help">
                      {plu ? fmt(plu.mrp) : '—'}
                    </span>
                  </td>

                  {/* Sale Price (editable) */}
                  <EditableCell
                    p={p} plu={plu} field="sellingPrice"
                    editing={editing} saving={editMutation.isPending}
                    editInputRef={editInputRef as React.RefObject<HTMLInputElement>}
                    onStart={() => startEdit(p, 'sellingPrice')}
                    onCommit={commitEdit}
                    onCancel={cancelEdit}
                    onChange={(v) => setEditing((e) => e ? { ...e, value: v } : e)}
                  />

                  {/* Wholesale (editable) */}
                  <EditableCell
                    p={p} plu={plu} field="wholesalePrice"
                    editing={editing} saving={editMutation.isPending}
                    editInputRef={editInputRef as React.RefObject<HTMLInputElement>}
                    onStart={() => startEdit(p, 'wholesalePrice')}
                    onCommit={commitEdit}
                    onCancel={cancelEdit}
                    onChange={(v) => setEditing((e) => e ? { ...e, value: v } : e)}
                  />

                  {/* Min Sale (editable) */}
                  <EditableCell
                    p={p} plu={plu} field="minSellingPrice"
                    editing={editing} saving={editMutation.isPending}
                    editInputRef={editInputRef as React.RefObject<HTMLInputElement>}
                    onStart={() => startEdit(p, 'minSellingPrice')}
                    onCommit={commitEdit}
                    onCancel={cancelEdit}
                    onChange={(v) => setEditing((e) => e ? { ...e, value: v } : e)}
                  />

                  {/* GST% (editable dropdown) */}
                  <GstCell
                    p={p} plu={plu}
                    editing={editing} saving={editMutation.isPending}
                    editInputRef={editInputRef as React.RefObject<HTMLSelectElement>}
                    onStart={() => startEdit(p, 'gstRate')}
                    onCommit={commitEdit}
                    onCancel={cancelEdit}
                    onChange={(v) => setEditing((e) => e ? { ...e, value: v } : e)}
                  />

                  {/* Online toggle + pack label */}
                  <td className="px-3 py-2.5 text-center">
                    {plu ? (
                      <div className="flex flex-col items-center gap-1 min-w-[90px]">
                        <button
                          type="button"
                          disabled={togglingOnlineId === plu.id || onlineToggleMutation.isPending}
                          onClick={() => {
                            setTogglingOnlineId(plu.id);
                            onlineToggleMutation.mutate({ productId: p.id, pluId: plu.id, availableOnline: !plu.availableOnline });
                          }}
                          title={plu.availableOnline ? 'Remove from online store' : 'Publish to online store'}
                          className={`w-9 h-5 rounded-full transition-colors relative disabled:opacity-50 ${plu.availableOnline ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${plu.availableOnline ? 'translate-x-4' : ''}`} />
                        </button>
                        {plu.availableOnline && plu.onlinePrice != null && (
                          <span className="text-xs text-green-700 font-medium">₹{fmt(plu.onlinePrice)}</span>
                        )}
                        {/* Pack label inline edit */}
                        {editingPackLabel?.pluId === plu.id ? (
                          <div className="flex items-center gap-0.5">
                            <input
                              autoFocus
                              value={editingPackLabel.value}
                              onChange={(e) => setEditingPackLabel(el => el ? { ...el, value: e.target.value } : el)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') packLabelMutation.mutate({ productId: editingPackLabel.productId, pluId: plu.id, packLabel: editingPackLabel.value.trim() || null });
                                if (e.key === 'Escape') setEditingPackLabel(null);
                              }}
                              maxLength={60}
                              className="w-20 border border-blue-400 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                              disabled={packLabelMutation.isPending}
                            />
                            <button
                              onClick={() => packLabelMutation.mutate({ productId: editingPackLabel.productId, pluId: plu.id, packLabel: editingPackLabel.value.trim() || null })}
                              disabled={packLabelMutation.isPending}
                              className="text-green-600 hover:text-green-800"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button onClick={() => setEditingPackLabel(null)} className="text-gray-400 hover:text-gray-700">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingPackLabel({ productId: p.id, pluId: plu.id, value: plu.displayName ?? '' })}
                            title="Set pack label"
                            className="text-xs text-gray-400 hover:text-blue-600 max-w-[88px] truncate"
                          >
                            {plu.displayName ?? 'add label'}
                          </button>
                        )}
                      </div>
                    ) : '—'}
                  </td>

                  {/* Margin% (cost-viewers only) */}
                  {showCost && (
                    <td className="px-3 py-2.5 text-right text-gray-600">
                      {plu ? margin(plu.mrp, plu.costPrice ?? 0) : '—'}
                    </td>
                  )}

                  {/* Stock */}
                  <td className="px-3 py-2.5 text-right text-gray-700">
                    {plu ? Number(plu.stockOnHand ?? 0).toFixed(2) : '0.00'}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full border font-medium ${
                      p.isActive
                        ? 'bg-green-50 text-green-700 border-green-100'
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Navigate to PLU detail */}
                  <td className="px-2 py-2.5">
                    <button
                      onClick={() => router.push(`/dashboard/products/${p.id}/plu`)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title="Open PLU detail"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── PLU Detail Panel ── */}
      {panelProduct && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setPanelProduct(null)} />
          <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h2 className="font-bold text-gray-900 text-base">{panelProduct.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{panelProduct.productCode} · {panelProduct.unitOfMeasure} · {panelProduct.activePluCount} PLU{panelProduct.activePluCount !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/dashboard/products/${panelProduct.id}/plu`)}
                  className="text-xs text-[#1B4F8A] hover:underline"
                >
                  Full PLU page →
                </button>
                <button onClick={() => setPanelProduct(null)} className="text-gray-400 hover:text-gray-700 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto p-5">
              {panelLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                </div>
              ) : panelPlus.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-sm mb-3">No PLUs yet</p>
                  <button
                    onClick={() => router.push(`/dashboard/products/${panelProduct.id}/plu`)}
                    className="text-sm text-[#1B4F8A] hover:underline"
                  >
                    + Add first PLU
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {panelPlus.filter(pl => !pl.isArchived).map((pl) => (
                    <div key={pl.id} className={`border rounded-xl p-4 ${pl.isDefault ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-gray-700">{pl.pluCode}</span>
                          {pl.isDefault && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1"><Star className="w-2.5 h-2.5" />Default</span>}
                          {!pl.isActive && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Inactive</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>Stock: <span className="font-semibold text-gray-700">{Number(pl.stockOnHand).toFixed(2)}</span></span>
                          <span>GST: <span className="font-semibold text-gray-700">{pl.gstRate}%</span></span>
                        </div>
                      </div>

                      {/* Prices grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'MRP', field: 'mrp', value: pl.mrp, locked: true },
                          { label: 'Sale Price', field: 'sellingPrice', value: pl.sellingPrice, locked: false },
                          { label: 'Wholesale', field: 'wholesalePrice', value: pl.wholesalePrice, locked: false },
                          { label: 'Min Sale', field: 'minSellingPrice', value: pl.minSellingPrice, locked: false },
                        ].map(({ label, field, value, locked }) => (
                          <div key={field}>
                            <div className="text-xs text-gray-400 mb-1">{label}{locked && ' 🔒'}</div>
                            {!locked && panelEditField?.pluId === pl.id && panelEditField?.field === field ? (
                              <div className="flex items-center gap-1">
                                <input
                                  autoFocus
                                  type="number"
                                  step="0.01"
                                  value={panelEditField.value}
                                  onChange={(e) => setPanelEditField(f => f ? { ...f, value: e.target.value } : f)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const n = parseFloat(panelEditField.value);
                                      if (!isNaN(n)) savePanelField(panelProduct.id, pl.id, field, n);
                                    }
                                    if (e.key === 'Escape') setPanelEditField(null);
                                  }}
                                  className="w-20 text-xs border border-blue-400 rounded px-1.5 py-1 focus:outline-none"
                                />
                                <button onClick={() => { const n = parseFloat(panelEditField.value); if (!isNaN(n)) savePanelField(panelProduct.id, pl.id, field, n); }} className="text-green-600"><Check className="w-3 h-3" /></button>
                                <button onClick={() => setPanelEditField(null)} className="text-gray-400"><X className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <button
                                onClick={() => !locked && setPanelEditField({ pluId: pl.id, field, value: String(value ?? '') })}
                                className={`text-sm font-semibold ${locked ? 'text-gray-700 cursor-default' : 'text-gray-800 hover:text-blue-600 cursor-pointer group flex items-center gap-1'}`}
                              >
                                ₹{value != null ? Number(value).toFixed(2) : '—'}
                                {!locked && <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* EAN code */}
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <Barcode className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs text-gray-500">EAN / Barcode:</span>
                          {editingEan?.pluId === pl.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                value={editingEan.value}
                                onChange={(e) => setEditingEan(el => el ? { ...el, value: e.target.value } : el)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEan(panelProduct.id, pl.id, editingEan.value);
                                  if (e.key === 'Escape') setEditingEan(null);
                                }}
                                placeholder="Enter EAN barcode"
                                className="text-xs font-mono border border-blue-400 rounded px-2 py-0.5 focus:outline-none w-40"
                                disabled={savingEan}
                              />
                              <button onClick={() => saveEan(panelProduct.id, pl.id, editingEan.value)} disabled={savingEan} className="text-green-600"><Check className="w-3 h-3" /></button>
                              <button onClick={() => setEditingEan(null)} className="text-gray-400"><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingEan({ pluId: pl.id, value: pl.eanCode ?? '' })}
                              className="text-xs font-mono text-gray-600 hover:text-blue-600 flex items-center gap-1 group"
                            >
                              {pl.eanCode ?? <span className="text-gray-400 italic">none — click to add</span>}
                              <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <button
                onClick={() => router.push(`/dashboard/products/${panelProduct.id}/plu`)}
                className="flex items-center gap-1.5 text-sm text-[#1B4F8A] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add New PLU
              </button>
              <button onClick={() => setPanelProduct(null)} className="text-sm text-gray-500 hover:text-gray-800">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk action dialog ── */}
      {bulkAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setBulkAction(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900">
              {bulkAction === 'gstRate' && 'Update GST Rate'}
              {bulkAction === 'discount' && 'Apply Discount %'}
              {bulkAction === 'margin' && 'Set Target Margin %'}
              {bulkAction === 'activate' && 'Activate Products'}
              {bulkAction === 'deactivate' && 'Deactivate Products'}
            </h3>
            <p className="text-sm text-gray-500">
              Applies to <span className="font-semibold text-gray-800">{selectedIds.size}</span> selected product{selectedIds.size !== 1 ? 's' : ''}.
            </p>

            {bulkAction === 'gstRate' && (
              <select
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Select GST rate</option>
                {GST_RATES.map((r) => <option key={r} value={String(r)}>{r}%</option>)}
              </select>
            )}

            {(bulkAction === 'discount' || bulkAction === 'margin') && (
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="99"
                  step="0.1"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  placeholder={bulkAction === 'discount' ? 'e.g. 10 for 10% off' : 'e.g. 25 for 25% margin'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm pr-8 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            )}

            {(bulkAction === 'activate' || bulkAction === 'deactivate') && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                {bulkAction === 'deactivate'
                  ? 'Selected products will be hidden from POS billing.'
                  : 'Selected products will be made available in POS billing.'}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setBulkAction(null); setBulkValue(''); }}
                disabled={bulkMutation.isPending}
                className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={runBulkAction}
                disabled={bulkMutation.isPending || ((bulkAction === 'discount' || bulkAction === 'margin' || bulkAction === 'gstRate') && !bulkValue)}
                className="flex-1 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 font-medium"
              >
                {bulkMutation.isPending ? 'Saving…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EditableCell ─────────────────────────────────────────────────────────────

interface EditableCellProps {
  p: ProductRow;
  plu: DefaultPlu | null;
  field: EditableField;
  editing: EditingCell | null;
  saving: boolean;
  editInputRef: React.RefObject<HTMLInputElement>;
  onStart: () => void;
  onCommit: () => void;
  onCancel: () => void;
  onChange: (v: string) => void;
}

function EditableCell({ p, plu, field, editing, saving, editInputRef, onStart, onCommit, onCancel, onChange }: EditableCellProps) {
  const isEditing = editing?.productId === p.id && editing?.field === field;
  const value = plu ? (plu[field] ?? null) : null;

  if (isEditing) {
    return (
      <td className="px-1 py-1.5">
        <div className="flex items-center gap-1">
          <input
            ref={editInputRef as React.RefObject<HTMLInputElement>}
            type="number"
            step="0.01"
            value={editing!.value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onCommit(); }
              if (e.key === 'Escape') onCancel();
            }}
            className="w-24 border border-blue-400 rounded px-2 py-1 text-sm text-right focus:outline-none"
            disabled={saving}
          />
          <button onClick={onCommit} disabled={saving} className="text-green-600 hover:text-green-800">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    );
  }

  return (
    <td
      className={`px-3 py-2.5 text-right group ${plu ? 'cursor-pointer hover:bg-blue-50' : ''}`}
      onClick={plu ? onStart : undefined}
      title={plu ? 'Click to edit' : undefined}
    >
      <span className="text-gray-700 group-hover:text-blue-700">
        {value != null ? fmt(value as number) : '—'}
      </span>
    </td>
  );
}

// ─── GstCell ─────────────────────────────────────────────────────────────────

interface GstCellProps {
  p: ProductRow;
  plu: DefaultPlu | null;
  editing: EditingCell | null;
  saving: boolean;
  editInputRef: React.RefObject<HTMLSelectElement>;
  onStart: () => void;
  onCommit: () => void;
  onCancel: () => void;
  onChange: (v: string) => void;
}

function GstCell({ p, plu, editing, saving, editInputRef, onStart, onCommit, onCancel, onChange }: GstCellProps) {
  const isEditing = editing?.productId === p.id && editing?.field === 'gstRate';

  if (isEditing) {
    return (
      <td className="px-1 py-1.5">
        <div className="flex items-center gap-1">
          <select
            ref={editInputRef as React.RefObject<HTMLSelectElement>}
            value={editing!.value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onCommit(); }
              if (e.key === 'Escape') onCancel();
            }}
            className="border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none"
            disabled={saving}
          >
            {GST_RATES.map((r) => <option key={r} value={String(r)}>{r}%</option>)}
          </select>
          <button onClick={onCommit} disabled={saving} className="text-green-600 hover:text-green-800">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    );
  }

  return (
    <td
      className={`px-3 py-2.5 text-right group ${plu ? 'cursor-pointer hover:bg-blue-50' : ''}`}
      onClick={plu ? onStart : undefined}
      title={plu ? 'Click to edit' : undefined}
    >
      <span className="text-gray-700 group-hover:text-blue-700">
        {plu ? (plu.gstRate ?? 0) + '%' : '—'}
      </span>
    </td>
  );
}
