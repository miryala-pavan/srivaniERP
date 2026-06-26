'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Plus, Search, Edit2, X, Check, Package, List, LayoutGrid,
  AlignJustify, ChevronDown, AlertCircle, Ban, Loader2, Info,
  Tag, Layers, Lock, Globe, GlobeLock, Printer,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { useWebSocket } from '@/providers/WebSocketProvider';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { broadcastERP } from '@/hooks/useERPBroadcast';
import { getUser } from '@/lib/auth';
import { openInNewWindow } from '@/lib/new-window';
import { toTitleCase, cleanSpaces, applyLiveCorrection } from '@/lib/input-utils';
import { FieldHelp } from '@/components/ui/FieldHelp';
import type { FieldHelpProps } from '@/components/ui/FieldHelp';
import { useFormAutosave } from '@/hooks/useFormAutosave';
import { RestoreBanner } from '@/components/ui/RestoreBanner';
import { EntityLink } from '@/components/shared/EntityLink';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { ProductImage } from '@/components/shared/ProductImage';
import { BarcodeScannerInput } from '@/components/shared/BarcodeScannerInput';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Dept     { id: string; name: string; code: string; }
interface CatNode  { id: string; name: string; code: string; label: string; departmentId: string | null; hsnCode?: string | null; children: CatNode[]; }
interface CatFlat  { id: string; name: string; code: string; label: string; departmentId: string | null; parent?: { id: string; label: string; name: string } | null; }
interface Tax      { id: string; taxName: string; taxRate: number | string; taxCode: string; }
interface Brand    { id: string; name: string; }

interface Product {
  id: string; productCode?: string | null; name: string; shortName?: string | null;
  barcode?: string | null; hsnCode: string; unitOfMeasure: string; productType?: string;
  mrp: number | string; sellingPrice: number | string; costPrice?: number | string | null;
  gstRatePercent?: number | string | null; reorderLevel: number | string;
  isActive: boolean; isManuallyDisabled: boolean; autoInactiveReason?: string | null;
  availableOnline: boolean;
  currentStock: number;
  isReturnable?: boolean; returnPeriodDays?: number; nonReturnableReason?: string | null;
  category?: { id: string; name: string; code?: string; label?: string; parent?: { id: string; name: string; label?: string } | null } | null;
  brand?: { id: string; name: string } | null;
  tax: { id: string; taxName: string; taxRate: number | string };
  defaultPlu?: { id: string; pluCode: string; sellingPrice: number; mrp: number; costPrice: number; gstRate: number; cessRate: number; wholesalePrice: number | null; stockOnHand: number; } | null;
  activePluCount?: number;
  imageUrl?: string | null;
  updatedAt?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRODUCT_TYPES = [
  { value: 'STANDARD', label: 'Standard' }, { value: 'LOOSE', label: 'Loose / Weighable' },
  { value: 'REPACKED', label: 'Repacked' }, { value: 'RAW_MATERIAL', label: 'Raw Material' },
  { value: 'PACKAGING', label: 'Packaging Material' },
];
const SORT_OPTIONS = [
  { value: 'code:asc',            label: 'Code ↑' },
  { value: 'code:desc',           label: 'Code ↓' },
  { value: 'name:asc',            label: 'Name A–Z' },
  { value: 'name:desc',           label: 'Name Z–A' },
  { value: 'mrp:asc',             label: 'MRP Low→High' },
  { value: 'mrp:desc',            label: 'MRP High→Low' },
  { value: 'sellingPrice:asc',    label: 'Selling Low→High' },
  { value: 'sellingPrice:desc',   label: 'Selling High→Low' },
  { value: 'stock:asc',           label: 'Stock Low→High' },
  { value: 'stock:desc',          label: 'Stock High→Low' },
  { value: 'gstRatePercent:asc',  label: 'GST Rate ↑' },
  { value: 'gstRatePercent:desc', label: 'GST Rate ↓' },
  { value: 'createdAt:desc',      label: 'Recently Added' },
  { value: 'createdAt:asc',       label: 'Oldest First' },
];
const STATUS_OPTIONS = [
  { value: '',              label: 'All Status' },
  { value: 'ACTIVE',        label: 'Active' },
  { value: 'DISABLED',      label: 'Disabled' },
  { value: 'OUT_OF_STOCK',  label: 'Out of Stock' },
];
const STOCK_OPTIONS = [
  { value: '',             label: 'All Stock' },
  { value: 'IN_STOCK',     label: 'In Stock' },
  { value: 'LOW_STOCK',    label: 'Low Stock' },
  { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
];
const GST_OPTIONS = [
  { value: '',   label: 'All GST' }, { value: '0',  label: 'GST 0%' },
  { value: '5',  label: 'GST 5%' }, { value: '12', label: 'GST 12%' },
  { value: '18', label: 'GST 18%' }, { value: '28', label: 'GST 28%' },
];

const PURCH_OPTIONS = ['PCS', 'KG', 'BTL', 'PKT', 'BOX', 'CASE', 'LTR'];
const STOCK_OPTIONS_UNIT = ['PCS', 'KG', 'BTL', 'PKT', 'BOX', 'LTR'];

const EMPTY_FORM = {
  name: '', shortName: '', barcode: '', hsnCode: '', unitOfMeasure: 'PCS',
  productType: 'STANDARD', mrp: '', sellingPrice: '', costPrice: '', reorderLevel: '10',
  departmentId: '', mainCategoryId: '', categoryId: '', taxId: '', isActive: true,
  isReturnable: true, returnPeriodDays: '7', nonReturnableReason: '',
  expiryTracking: false, minimumStockLevel: '0', reorderQuantity: '0',
  defaultPackSize: '1', allowNegativeStock: false, allowBelowMargin: false, cessRate: '0',
  purchaseUnit: 'PCS', stockUnit: 'PCS', brandId: '',
  keywords: '', description: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatus(p: Product): 'ACTIVE' | 'DISABLED' | 'OUT_OF_STOCK' {
  if (p.isManuallyDisabled) return 'DISABLED';
  if (p.currentStock <= 0) return 'OUT_OF_STOCK';
  return 'ACTIVE';
}

function stockColor(p: Product): string {
  if (p.currentStock <= 0) return 'text-red-600';
  if (p.currentStock <= Number(p.reorderLevel)) return 'text-amber-600';
  return 'text-green-700';
}

const fmt = (n: number | string) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(n));

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ product }: { product: Product }) {
  const st = getStatus(product);
  if (st === 'DISABLED')
    return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 font-medium"><Ban className="w-3 h-3" />Disabled</span>;
  if (st === 'OUT_OF_STOCK')
    return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium"><AlertCircle className="w-3 h-3" />Out of Stock</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Active</span>;
}

// ─── PLU Badge ───────────────────────────────────────────────────────────────

function PluBadge({ product, onClick }: { product: Product; onClick?: () => void }) {
  const count = product.activePluCount ?? 0;
  const plu   = product.defaultPlu;
  const cls = "cursor-pointer hover:opacity-80 transition-opacity";
  if (count === 0) return <span onClick={onClick} className={`text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium ${cls}`}>No PLU</span>;
  if (count > 1)   return <span onClick={onClick} className={`text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium ${cls}`}>{count} prices</span>;
  return <span onClick={onClick} className={`text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-mono font-medium ${cls}`}>{plu?.pluCode ?? 'PLU'}</span>;
}

// ─── Inline Tax Cell ─────────────────────────────────────────────────────────

function TaxCell({ product, taxes, onUpdate }: { product: Product; taxes: Tax[]; onUpdate: (taxId: string) => void }) {
  const [editing, setEditing] = useState(false);

  async function handleChange(taxId: string) {
    setEditing(false);
    if (taxId === product.tax.id) return;
    onUpdate(taxId);
  }

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={product.tax.id}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
        className="text-xs border border-[#1B4F8A] rounded px-1.5 py-0.5 focus:outline-none bg-white"
      >
        {taxes.map((t) => <option key={t.id} value={t.id}>{t.taxName}</option>)}
      </select>
    );
  }
  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-pointer group inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded hover:bg-purple-100 transition-colors"
      title="Click to change tax rate"
    >
      GST {product.tax.taxRate}%
      <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </span>
  );
}

// ─── HsnCell inline edit ─────────────────────────────────────────────────────

const VALID_HSN_LENGTHS = [4, 6, 8];

function HsnCell({ product, onUpdate }: { product: Product; onUpdate: (hsn: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(product.hsnCode);
  const isUnset = product.hsnCode === '0000' || !product.hsnCode;

  function handleCommit() {
    const hsn = val.trim();
    if (!VALID_HSN_LENGTHS.includes(hsn.length) || !/^\d+$/.test(hsn)) {
      toast.error('HSN must be 4, 6, or 8 digits');
      setVal(product.hsnCode);
      setEditing(false);
      return;
    }
    setEditing(false);
    if (hsn !== product.hsnCode) onUpdate(hsn);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/\D/g, '').slice(0, 8))}
        onBlur={handleCommit}
        onKeyDown={(e) => { if (e.key === 'Enter') handleCommit(); if (e.key === 'Escape') { setVal(product.hsnCode); setEditing(false); } }}
        className="w-24 text-xs font-mono border border-[#1B4F8A] rounded px-1.5 py-0.5 focus:outline-none"
        placeholder="4/6/8 digits"
      />
    );
  }

  return (
    <span
      onClick={() => { setVal(product.hsnCode); setEditing(true); }}
      className={`cursor-pointer group inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded transition-colors ${
        isUnset
          ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
      title="Click to edit HSN code"
    >
      {product.hsnCode || '0000'}
      <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </span>
  );
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const sourceGrn    = searchParams?.get('source') === 'grn';

  // ── Data ──────────────────────────────────────────────
  const [page, setPage]           = useState(1);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [catTree, setCatTree]     = useState<CatNode[]>([]);
  const [catFlat, setCatFlat]     = useState<CatFlat[]>([]);
  const [taxes, setTaxes]         = useState<Tax[]>([]);
  const [brands, setBrands]       = useState<Brand[]>([]);
  const queryClient               = useQueryClient();
  const { connected }             = useWebSocket();

  // ── Filters ───────────────────────────────────────────
  const [search, setSearch]           = useState('');
  const [filterDeptId, setFilterDeptId] = useState('');
  const [mainCatId, setMainCatId]     = useState('');
  const [subCatId, setSubCatId]       = useState('');
  const [brandId, setBrandId]         = useState('');
  const [productType, setProductType] = useState('');
  const [status, setStatus]           = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [gstRate, setGstRate]         = useState('');
  const [hsnFilter, setHsnFilter]     = useState('');
  const [imageFilter, setImageFilter] = useState('');   // '' | 'WITH_IMAGE' | 'WITHOUT_IMAGE'
  const [sortKey, setSortKey]         = useState('code:asc');

  // PLU quick-view panel
  const [pluPanel, setPluPanel]             = useState<Product | null>(null);
  const [pluPanelData, setPluPanelData]     = useState<any[]>([]);
  const [pluPanelLoading, setPluPanelLoading] = useState(false);
  const [pluPanelTaxRates, setPluPanelTaxRates] = useState<{ id: string; taxName: string; taxRate: number }[]>([]);
  const [pluPanelEditId, setPluPanelEditId] = useState<string | null>(null);
  const [pluPanelEditForm, setPluPanelEditForm] = useState({
    mrp: '', sellingPrice: '', wholesalePrice: '', minSellingPrice: '',
    gstRate: '', cessRate: '', taxInclusive: false, availableOnline: false,
    onlinePrice: '', packLabel: '',
  });
  const [pluPanelSaving, setPluPanelSaving]   = useState(false);
  const [showPluPanelAdd, setShowPluPanelAdd] = useState(false);
  const [pluPanelAddForm, setPluPanelAddForm] = useState({ mrp: '', sellingPrice: '', gstRate: '', cessRate: '0', packLabel: '' });
  const [pluPanelAddSaving, setPluPanelAddSaving] = useState(false);

  // ── View ──────────────────────────────────────────────
  const [view, setView] = useState<'list' | 'card' | 'compact'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('productView') as any) ?? 'list';
    return 'list';
  });

  // ── Modal / Action state ──────────────────────────────
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState<Product | null>(null);
  const [form, setForm]                 = useState({ ...EMPTY_FORM });
  const isManager = ['SUPER_ADMIN', 'BRANCH_MANAGER'].includes((getUser() as any)?.role ?? '');
  const [saving, setSaving]             = useState(false);
  const [sellingPriceError, setSellingPriceError] = useState('');
  const [costPriceWarn, setCostPriceWarn]         = useState('');
  const [disableTarget, setDisableTarget] = useState<Product | null>(null);

  // Bulk selection for label printing
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Short name auto-copy state
  const [shortNameEdited, setShortNameEdited] = useState(false);

  // Dup check state
  const [dupMatches, setDupMatches]       = useState<Array<{ id: string; name: string; productCode?: string | null; isActive: boolean }>>([]);
  const [showDupModal, setShowDupModal]   = useState(false);

  // Brand dropdown state
  const [brandSearch, setBrandSearch]     = useState('');
  const [showBrandDrop, setShowBrandDrop] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [newBrandName, setNewBrandName]   = useState('');
  const [savingBrand, setSavingBrand]     = useState(false);
  const brandDropRef = useRef<HTMLDivElement>(null);

  // Quick-add inline modals for classification dropdowns
  const [quickAdd, setQuickAdd] = useState<'dept' | 'cat' | 'sub' | null>(null);
  const [quickAddName, setQuickAddName] = useState('');
  const [savingQuickAdd, setSavingQuickAdd] = useState(false);

  // Image state
  const [pendingImage, setPendingImage]           = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage]       = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Filter bar: categories filtered by selected department
  const filterCatsByDept = filterDeptId
    ? catTree.filter((c) => c.departmentId === filterDeptId)
    : catTree;
  const subCats = catTree.find((c) => c.id === mainCatId)?.children ?? [];

  // Form: categories filtered by department selection in the form
  const formCatsByDept = (form as any).departmentId
    ? catTree.filter((c) => c.departmentId === (form as any).departmentId)
    : catTree;
  const formSubCats = catTree.find((c) => c.id === form.mainCategoryId)?.children ?? [];

  const filteredBrandsInDrop = brandSearch.trim()
    ? brands.filter((b) => b.name.toLowerCase().includes(brandSearch.toLowerCase()))
    : brands;

  useEffect(() => {
    function h(e: MouseEvent) {
      if (brandDropRef.current && !brandDropRef.current.contains(e.target as Node)) {
        setShowBrandDrop(false);
      }
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEscapeKey(() => setShowDupModal(false), showDupModal);
  useEscapeKey(() => setShowBrandModal(false), showBrandModal && !showDupModal);
  useEscapeKey(() => setShowModal(false), showModal && !showDupModal && !showBrandModal);
  useEscapeKey(() => setDisableTarget(null), !!disableTarget && !showModal);

  useEffect(() => {
    const handler = () => setShowModal(true);
    window.addEventListener('erp:new', handler);
    return () => window.removeEventListener('erp:new', handler);
  }, []);

  // ── Search debounce ───────────────────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);
  const [sortBy, sortOrder] = sortKey.split(':');

  // ─── Sort Header ──────────────────────────────────────────
  function SortHeader({ col, label, className = '' }: { col: string; label: string; className?: string }) {
    const [activeSortBy, activeSortOrder] = sortKey.split(':');
    const isActive = activeSortBy === col;
    function handleClick() {
      setSortKey(isActive ? `${col}:${activeSortOrder === 'asc' ? 'desc' : 'asc'}` : `${col}:asc`);
    }
    return (
      <th
        onClick={handleClick}
        className={`cursor-pointer select-none transition-colors ${isActive ? 'text-[#1B4F8A]' : 'text-gray-500 hover:text-gray-700'} ${className}`}
      >
        <span className="inline-flex items-center gap-0.5">
          {label}
          {isActive && <span>{activeSortOrder === 'asc' ? ' ↑' : ' ↓'}</span>}
        </span>
      </th>
    );
  }

  const { data: productData, isLoading } = useQuery({
    queryKey: ['products', { page, search: debouncedSearch, departmentId: filterDeptId || undefined, categoryId: subCatId || mainCatId || undefined, brandId: brandId || undefined, productType: productType || undefined, status: status || undefined, stockStatus: stockStatus || undefined, gstRate: gstRate || undefined, hsnFilter: hsnFilter || undefined, imageFilter: imageFilter || undefined, sortBy, sortOrder }],
    queryFn: async () => {
      const res = await api.get('/products', {
        params: {
          page, limit: 20,
          search:       debouncedSearch  || undefined,
          departmentId: filterDeptId     || undefined,
          categoryId:   subCatId || mainCatId || undefined,
          brandId:      brandId          || undefined,
          productType:  productType      || undefined,
          status:       status           || undefined,
          stockStatus:  stockStatus      || undefined,
          gstRate:      gstRate          || undefined,
          hsnCode:      hsnFilter        || undefined,
          imageFilter:  imageFilter      || undefined,
          sortBy, sortOrder,
        },
      });
      return res.data;
    },
    placeholderData: (prev) => prev,
  });
  const products   = (productData?.data       ?? []) as Product[];
  const total      = (productData?.total      ?? 0)  as number;
  const totalPages = (productData?.totalPages ?? 1)  as number;

  useEffect(() => {
    Promise.all([
      api.get('/departments?isActive=true'),
      api.get('/products/categories'),
      api.get('/products/categories/flat'),
      api.get('/products/taxes'),
      api.get('/products/brands'),
    ]).then(([depts, tree, flat, tax, br]) => {
      setDepartments(depts.data ?? []);
      setCatTree(tree.data.data ?? tree.data ?? []);
      setCatFlat(flat.data.data ?? flat.data ?? []);
      setTaxes(tax.data.data ?? tax.data ?? []);
      setBrands(br.data.data ?? br.data ?? []);
    }).catch(() => {});
  }, []);

  // ── Page reset on filter change ───────────────────────
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterDeptId, mainCatId, subCatId, brandId, productType, status, stockStatus, gstRate, hsnFilter, imageFilter, sortKey]);

  // ── WebSocket live updates ────────────────────────────
  useWebSocketEvent('product.created',          () => queryClient.invalidateQueries({ queryKey: ['products'] }));
  useWebSocketEvent('product.updated',          () => queryClient.invalidateQueries({ queryKey: ['products'] }));
  useWebSocketEvent('plu.updated',              () => queryClient.invalidateQueries({ queryKey: ['products'] }));
  useWebSocketEvent('inventory.stock-adjusted', () => queryClient.invalidateQueries({ queryKey: ['products'] }));

  // ── Mutations ─────────────────────────────────────────
  const taxMutation = useMutation({
    mutationFn: async ({ productId, taxId }: { productId: string; taxId: string }) => {
      await api.put(`/products/${productId}/tax`, { taxId });
      return { taxId };
    },
    onSuccess: (_, { taxId }) => {
      const taxName = taxes.find((t) => t.id === taxId)?.taxName ?? '';
      toast.success(`Tax updated to ${taxName}`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: any) => { toast.error(e?.response?.data?.message ?? 'Tax update failed'); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ productId, action }: { productId: string; action: 'DISABLE' | 'ENABLE' }) => {
      await api.put(`/products/${productId}/toggle-status`, { action });
      return { action };
    },
    onSuccess: (_, { action }) => {
      toast.success(action === 'DISABLE' ? 'Product disabled' : 'Product enabled');
      setDisableTarget(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: any) => { toast.error(e?.response?.data?.message ?? 'Action failed'); },
  });

  const onlineMutation = useMutation({
    mutationFn: async ({ productId, online }: { productId: string; online: boolean }) => {
      await api.put(`/products/${productId}/online-visibility`, { online });
      return { productId, online };
    },
    onSuccess: (_, { online }) => {
      toast.success(online ? 'Product visible on storefront' : 'Product hidden from storefront');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: any) => { toast.error(e?.response?.data?.message ?? 'Failed to update visibility'); },
  });

  const bulkOnlineMutation = useMutation({
    mutationFn: async ({ ids, online }: { ids: string[]; online: boolean }) => {
      await api.put('/products/bulk-online-visibility', { ids, online });
      return { ids, online };
    },
    onSuccess: ({ ids, online }) => {
      toast.success(`${ids.length} product${ids.length !== 1 ? 's' : ''} ${online ? 'marked online' : 'hidden from storefront'}`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: any) => { toast.error(e?.response?.data?.message ?? 'Bulk update failed'); },
  });

  function setViewPersist(v: 'list' | 'card' | 'compact') {
    setView(v);
    localStorage.setItem('productView', v);
  }

  // ── Filter chips ──────────────────────────────────────
  const chips: Array<{ label: string; clear: () => void }> = [];
  if (filterDeptId) {
    const d = departments.find((d) => d.id === filterDeptId);
    chips.push({ label: d?.name ?? filterDeptId, clear: () => { setFilterDeptId(''); setMainCatId(''); setSubCatId(''); } });
  }
  if (mainCatId) {
    const c = catTree.find((c) => c.id === mainCatId);
    if (subCatId) {
      const sc = c?.children.find((ch) => ch.id === subCatId);
      chips.push({ label: `${sc?.label ?? ''} (${c?.label ?? ''})`, clear: () => { setSubCatId(''); setMainCatId(''); } });
    } else {
      chips.push({ label: c?.label ?? mainCatId, clear: () => { setMainCatId(''); setSubCatId(''); } });
    }
  }
  if (brandId) { const b = brands.find((b) => b.id === brandId); chips.push({ label: b?.name ?? brandId, clear: () => setBrandId('') }); }
  if (productType) chips.push({ label: PRODUCT_TYPES.find((t) => t.value === productType)?.label ?? productType, clear: () => setProductType('') });
  if (status) chips.push({ label: STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status, clear: () => setStatus('') });
  if (stockStatus) chips.push({ label: STOCK_OPTIONS.find((s) => s.value === stockStatus)?.label ?? stockStatus, clear: () => setStockStatus('') });
  if (gstRate) chips.push({ label: `GST ${gstRate}%`, clear: () => setGstRate('') });
  if (imageFilter === 'WITH_IMAGE')    chips.push({ label: '📷 With Image',    clear: () => setImageFilter('') });
  if (imageFilter === 'WITHOUT_IMAGE') chips.push({ label: '🚫 No Image',       clear: () => setImageFilter('') });

  function clearAll() { setSearch(''); setFilterDeptId(''); setMainCatId(''); setSubCatId(''); setBrandId(''); setProductType(''); setStatus(''); setStockStatus(''); setGstRate(''); setHsnFilter(''); setImageFilter(''); setSortKey('code:asc'); setPage(1); }

  // ── Auto-save (add-new only) ──────────────────────────
  const autosave = useFormAutosave('product', form, { enabled: showModal && editing === null });
  const [showRestore, setShowRestore] = useState(false);

  // ── Form handlers ─────────────────────────────────────
  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, taxId: taxes[0]?.id ?? '' });
    setSellingPriceError('');
    setCostPriceWarn('');
    setBrandSearch('');
    setShowBrandDrop(false);
    setShortNameEdited(false);
    setDupMatches([]);
    setPendingImage(null);
    setPendingImagePreview(null);
    setShowRestore(autosave.hasSaved());
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    const isSubCat = !!p.category?.parent;
    const parentCatId = isSubCat ? (p.category?.parent?.id ?? '') : (p.category?.id ?? '');
    const deptId = catFlat.find((c) => c.id === parentCatId)?.departmentId
      ?? catFlat.find((c) => c.id === (p.category?.id ?? ''))?.departmentId
      ?? '';
    setForm({
      name: p.name, shortName: p.shortName ?? '', barcode: p.barcode ?? '', hsnCode: p.hsnCode,
      unitOfMeasure: p.unitOfMeasure, productType: p.productType ?? 'STANDARD',
      mrp: String(p.mrp), sellingPrice: String(p.sellingPrice),
      costPrice: p.costPrice ? String(p.costPrice) : '', reorderLevel: String(p.reorderLevel),
      departmentId:   deptId,
      mainCategoryId: parentCatId,
      categoryId:     isSubCat ? (p.category?.id ?? '') : '',
      taxId: p.tax.id, isActive: p.isActive,
      isReturnable: p.isReturnable ?? true,
      returnPeriodDays: String(p.returnPeriodDays ?? 7),
      nonReturnableReason: p.nonReturnableReason ?? '',
      expiryTracking: (p as any).expiryTracking ?? false,
      minimumStockLevel: String((p as any).minimumStockLevel ?? 0),
      reorderQuantity: String((p as any).reorderQuantity ?? 0),
      defaultPackSize: String((p as any).defaultPackSize ?? 1),
      allowNegativeStock: (p as any).allowNegativeStock ?? false,
      allowBelowMargin: (p as any).allowBelowMargin ?? false,
      cessRate: String((p as any).cessRate ?? 0),
      purchaseUnit: (p as any).purchaseUnit ?? 'PCS',
      stockUnit: (p as any).stockUnit ?? 'PCS',
      brandId: p.brand?.id ?? '',
      keywords: (p as any).keywords ?? '',
      description: (p as any).description ?? '',
    });
    setSellingPriceError('');
    setCostPriceWarn('');
    setBrandSearch('');
    setShowBrandDrop(false);
    setShortNameEdited(false);
    setDupMatches([]);
    setPendingImage(null);
    setPendingImagePreview(null);
    setShowModal(true);
  }

  async function save() {
    if (!(form as any).departmentId) { toast.error('Department required'); return; }
    if (!form.mainCategoryId)        { toast.error('Category required'); return; }
    if (!form.categoryId)            { toast.error('Sub-category required'); return; }
    if (!form.name.trim())    { toast.error('Name required'); return; }
    if (!VALID_HSN_LENGTHS.includes(form.hsnCode.trim().length) || !/^\d+$/.test(form.hsnCode.trim())) { toast.error('HSN Code must be 4, 6, or 8 digits'); return; }
    if (!form.mrp)            { toast.error('MRP required'); return; }
    if (!form.sellingPrice)   { toast.error('Selling price required'); return; }
    if (!form.taxId)          { toast.error('Tax slab required'); return; }

    const resolvedCategoryId = form.categoryId;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), shortName: form.shortName.trim() || undefined,
        barcode: form.barcode.trim() || undefined, hsnCode: form.hsnCode.trim(),
        unitOfMeasure: form.unitOfMeasure, productType: form.productType,
        mrp: Number(form.mrp), sellingPrice: Number(form.sellingPrice),
        costPrice: form.costPrice ? Number(form.costPrice) : undefined,
        reorderLevel: Number(form.reorderLevel) || 10,
        departmentId: (form as any).departmentId || undefined,
        categoryId: resolvedCategoryId, taxId: form.taxId, isActive: form.isActive,
        isReturnable: form.isReturnable,
        returnPeriodDays: Number(form.returnPeriodDays) || 7,
        nonReturnableReason: !form.isReturnable && form.nonReturnableReason.trim() ? form.nonReturnableReason.trim() : undefined,
        expiryTracking: form.expiryTracking,
        minimumStockLevel: Number(form.minimumStockLevel) || 0,
        reorderQuantity: Number(form.reorderQuantity) || 0,
        defaultPackSize: Number(form.defaultPackSize) || 1,
        allowNegativeStock: form.allowNegativeStock,
        allowBelowMargin: form.allowBelowMargin,
        cessRate: Number(form.cessRate) || 0,
        purchaseUnit: form.purchaseUnit,
        stockUnit: form.stockUnit,
        brandId: (form as any).brandId || undefined,
        keywords: (form as any).keywords?.trim() || '',
        description: (form as any).description?.trim() || '',
      };
      if (editing) {
        const res = await api.put(`/products/${editing.id}`, payload);
        toast.success('Product updated');
        broadcastERP({ type: 'PRODUCT_UPDATED', id: res.data?.id ?? editing.id, name: res.data?.name ?? form.name });
      } else {
        const res = await api.post('/products', payload);
        const newId = res.data?.id;
        const pluCode = res.data?.pluCode ?? '';
        const barcode = res.data?.barcode ?? pluCode;
        if (pendingImage && newId) {
          try {
            const fd = new FormData();
            fd.append('file', pendingImage);
            await api.post(`/products/${newId}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          } catch { /* image upload failure is non-blocking */ }
        }
        toast.success(`Product added. PLU ${pluCode} auto-created. Barcode: ${barcode}`);
        broadcastERP({ type: 'PRODUCT_ADDED', id: newId, name: res.data?.name ?? form.name, barcode });
        autosave.clearSaved();
        if (sourceGrn) {
          setTimeout(() => window.close(), 1200);
          return;
        }
      }
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Save failed'); }
    finally          { setSaving(false); }
  }

  // ── Toggle status ─────────────────────────────────────
  function handleToggle(product: Product, action: 'DISABLE' | 'ENABLE') {
    toggleMutation.mutate({ productId: product.id, action });
  }

  // ── Dup-check (debounced, add-mode only) ─────────────
  useEffect(() => {
    if (editing || !form.name.trim() || form.name.trim().length < 3) {
      setDupMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/products/search-by-name', { params: { q: form.name.trim() } });
        setDupMatches(res.data ?? []);
      } catch { setDupMatches([]); }
    }, 500);
    return () => clearTimeout(t);
  }, [form.name, editing]);

  // ── Brand creation ───────────────────────────────────
  async function saveNewBrand() {
    if (!newBrandName.trim()) return;
    setSavingBrand(true);
    try {
      const res = await api.post('/products/brands', { name: newBrandName.trim() });
      setBrands((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((f) => ({ ...f, brandId: res.data.id }));
      setShowBrandModal(false);
      setNewBrandName('');
      setShowBrandDrop(false);
      toast.success(`Brand "${res.data.name}" created`);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed to create brand'); }
    finally { setSavingBrand(false); }
  }

  // ── Quick-add for classification dropdowns ────────────
  async function saveQuickAdd() {
    const name = quickAddName.trim();
    if (!name) return;
    setSavingQuickAdd(true);
    try {
      if (quickAdd === 'dept') {
        const res = await api.post('/departments', { name, code: name.toUpperCase().replace(/\s+/g, '_').slice(0, 20) });
        const newDept = { id: res.data.id, name: res.data.name, code: res.data.code };
        setDepartments((prev) => [...prev, newDept].sort((a, b) => a.name.localeCompare(b.name)));
        setForm((f) => ({ ...f, departmentId: res.data.id, mainCategoryId: '', categoryId: '' } as any));
        toast.success(`Department "${name}" created`);
      } else if (quickAdd === 'cat') {
        const deptId = (form as any).departmentId;
        if (!deptId) { toast.error('Select a department first'); return; }
        const code  = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || name.slice(0, 6).toUpperCase();
        const label = name.toUpperCase().replace(/\s+/g, ' ').slice(0, 20);
        const res = await api.post('/products/categories', { name, code, label, departmentId: deptId });
        const newCat = { id: res.data.id, name: res.data.name, code: res.data.code, label: res.data.label || name, departmentId: deptId, children: [] };
        setCatTree((prev) => [...prev, newCat].sort((a, b) => a.label.localeCompare(b.label)));
        setForm((f) => ({ ...f, mainCategoryId: res.data.id, categoryId: '' }));
        toast.success(`Category "${name}" created`);
      } else if (quickAdd === 'sub') {
        if (!form.mainCategoryId) { toast.error('Select a category first'); return; }
        const code  = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || name.slice(0, 6).toUpperCase();
        const label = name.toUpperCase().replace(/\s+/g, ' ').slice(0, 20);
        const res = await api.post('/products/subcategories', { name, code, label, categoryId: form.mainCategoryId });
        const newSub = { id: res.data.id, name: res.data.name, code: res.data.code, label: res.data.label || name, departmentId: null, children: [] };
        setCatTree((prev) => prev.map((c) =>
          c.id === form.mainCategoryId ? { ...c, children: [...c.children, newSub].sort((a, b) => a.label.localeCompare(b.label)) } : c,
        ));
        setForm((f) => ({ ...f, categoryId: res.data.id }));
        toast.success(`Sub-category "${name}" created`);
      }
      setQuickAdd(null);
      setQuickAddName('');
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Failed to create'); }
    finally { setSavingQuickAdd(false); }
  }

  // ── Inline tax update ─────────────────────────────────
  function handleTaxUpdate(productId: string, taxId: string) {
    taxMutation.mutate({ productId, taxId });
  }

  // ── PLU panel ─────────────────────────────────────────
  async function openPluPanel(product: Product) {
    setPluPanel(product);
    setPluPanelLoading(true);
    setPluPanelEditId(null);
    setShowPluPanelAdd(false);
    try {
      const [plusRes, taxRes] = await Promise.all([
        api.get(`/products/${product.id}/plus`),
        api.get('/products/taxes'),
      ]);
      setPluPanelData(plusRes.data ?? []);
      setPluPanelTaxRates(
        (taxRes.data ?? []).map((t: any) => ({
          id: t.id, taxName: t.taxName,
          taxRate: parseFloat(String(t.taxRate)),
        }))
      );
    } catch { setPluPanelData([]); }
    finally { setPluPanelLoading(false); }
  }

  async function refreshPluPanel() {
    if (!pluPanel) return;
    try {
      const res = await api.get(`/products/${pluPanel.id}/plus`);
      setPluPanelData(res.data ?? []);
    } catch {}
  }

  function openPluPanelEdit(pl: any) {
    setPluPanelEditId(pl.id);
    setShowPluPanelAdd(false);
    setPluPanelEditForm({
      mrp:             String(pl.mrp),
      sellingPrice:    String(pl.sellingPrice),
      wholesalePrice:  pl.wholesalePrice ? String(pl.wholesalePrice) : '',
      minSellingPrice: pl.minSellingPrice ? String(pl.minSellingPrice) : '',
      gstRate:         String(pl.gstRate ?? ''),
      cessRate:        String(pl.cessRate ?? 0),
      taxInclusive:    pl.taxInclusive ?? false,
      availableOnline: pl.availableOnline ?? false,
      onlinePrice:     pl.onlinePrice != null ? String(pl.onlinePrice) : '',
      packLabel:       pl.displayName ?? '',
    });
  }

  async function savePluPanelEdit(pluId: string) {
    if (!pluPanel) return;
    setPluPanelSaving(true);
    try {
      await api.patch(`/products/${pluPanel.id}/plus/${pluId}`, {
        mrp:             pluPanelEditForm.mrp             ? Number(pluPanelEditForm.mrp)             : undefined,
        sellingPrice:    pluPanelEditForm.sellingPrice    ? Number(pluPanelEditForm.sellingPrice)    : undefined,
        wholesalePrice:  pluPanelEditForm.wholesalePrice  ? Number(pluPanelEditForm.wholesalePrice)  : undefined,
        minSellingPrice: pluPanelEditForm.minSellingPrice ? Number(pluPanelEditForm.minSellingPrice) : undefined,
        gstRate:         pluPanelEditForm.gstRate         ? Number(pluPanelEditForm.gstRate)         : undefined,
        cessRate:        pluPanelEditForm.cessRate        ? Number(pluPanelEditForm.cessRate)        : undefined,
        taxInclusive:    pluPanelEditForm.taxInclusive,
        availableOnline: pluPanelEditForm.availableOnline,
        onlinePrice:     pluPanelEditForm.onlinePrice !== '' ? Number(pluPanelEditForm.onlinePrice) : null,
        packLabel:       pluPanelEditForm.packLabel.trim() || null,
      });
      toast.success('PLU updated');
      setPluPanelEditId(null);
      await refreshPluPanel();
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // If the edit modal is open for this same product, refresh its price fields.
      // Merge into editing — replacing it loses list-only fields like activePluCount.
      if (editing && editing.id === pluPanel.id) {
        const fresh = await api.get(`/products/${pluPanel.id}`);
        const p = fresh.data;
        setEditing(prev => prev ? { ...prev, mrp: p.mrp, sellingPrice: p.sellingPrice, costPrice: p.costPrice, gstRatePercent: p.gstRatePercent } : prev);
        setForm(f => ({
          ...f,
          mrp:          String(p.mrp ?? f.mrp),
          sellingPrice: String(p.sellingPrice ?? f.sellingPrice),
          costPrice:    p.costPrice ? String(p.costPrice) : f.costPrice,
        }));
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to update PLU');
    } finally { setPluPanelSaving(false); }
  }

  async function savePluPanelAdd() {
    if (!pluPanel) return;
    if (!pluPanelAddForm.mrp)          { toast.error('MRP required'); return; }
    if (!pluPanelAddForm.sellingPrice) { toast.error('Selling price required'); return; }
    setPluPanelAddSaving(true);
    try {
      await api.post(`/products/${pluPanel.id}/plus`, {
        mrp:          Number(pluPanelAddForm.mrp),
        sellingPrice: Number(pluPanelAddForm.sellingPrice),
        gstRate:      pluPanelAddForm.gstRate ? Number(pluPanelAddForm.gstRate) : undefined,
        cessRate:     pluPanelAddForm.cessRate ? Number(pluPanelAddForm.cessRate) : undefined,
        packLabel:    pluPanelAddForm.packLabel.trim() || undefined,
      });
      toast.success('PLU created');
      setShowPluPanelAdd(false);
      setPluPanelAddForm({ mrp: '', sellingPrice: '', gstRate: '', cessRate: '0', packLabel: '' });
      await refreshPluPanel();
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (editing && editing.id === pluPanel.id) {
        const fresh = await api.get(`/products/${pluPanel.id}`);
        const p = fresh.data;
        setEditing(prev => prev ? { ...prev, mrp: p.mrp, sellingPrice: p.sellingPrice, costPrice: p.costPrice, gstRatePercent: p.gstRatePercent, activePluCount: (prev.activePluCount ?? 0) + 1 } : prev);
        setForm(f => ({
          ...f,
          mrp:          String(p.mrp ?? f.mrp),
          sellingPrice: String(p.sellingPrice ?? f.sellingPrice),
          costPrice:    p.costPrice ? String(p.costPrice) : f.costPrice,
        }));
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to create PLU');
    } finally { setPluPanelAddSaving(false); }
  }

  // ── Inline HSN update ─────────────────────────────────
  async function handleHsnUpdate(productId: string, hsnCode: string) {
    try {
      await api.put(`/products/${productId}/hsn`, { hsnCode });
      toast.success(`HSN updated to ${hsnCode}`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'HSN update failed');
    }
  }

  // ── Category badge helper ─────────────────────────────
  function CatBadge({ product }: { product: Product }) {
    const cat = product.category;
    if (!cat?.label) return null;
    return (
      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
        {cat.label}
        {cat.parent?.label && <span className="text-blue-400 font-normal"> ({cat.parent.label})</span>}
      </span>
    );
  }

  // ── Toggle buttons ────────────────────────────────────
  function ToggleBtn({ product }: { product: Product }) {
    const st    = getStatus(product);
    const isBusy = toggleMutation.isPending && (toggleMutation.variables as any)?.productId === product.id;
    if (st === 'OUT_OF_STOCK') return null;
    if (st === 'ACTIVE') return (
      <button
        onClick={() => setDisableTarget(product)}
        disabled={isBusy}
        className="text-xs px-2 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        Disable
      </button>
    );
    return (
      <button
        onClick={() => handleToggle(product, 'ENABLE')}
        disabled={isBusy}
        className="text-xs px-2 py-1 border border-green-300 text-green-600 rounded hover:bg-green-50 transition-colors disabled:opacity-50"
      >
        {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Enable'}
      </button>
    );
  }

  // ── Online Visibility Toggle ──────────────────────────
  function OnlineToggle({ product }: { product: Product }) {
    const isBusy = onlineMutation.isPending &&
      (onlineMutation.variables as any)?.productId === product.id;
    const isOnline = product.availableOnline;

    return (
      <button
        onClick={() => onlineMutation.mutate({ productId: product.id, online: !isOnline })}
        disabled={isBusy}
        title={isOnline ? 'Visible on storefront — click to hide' : 'Hidden from storefront — click to show'}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border transition-all disabled:opacity-50 ${
          isOnline
            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
            : 'bg-gray-100 border-gray-300 text-gray-500 hover:bg-gray-200'
        }`}
      >
        {isBusy
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : isOnline
            ? <Globe className="w-3 h-3" />
            : <GlobeLock className="w-3 h-3" />
        }
        {isOnline ? 'Online' : 'Hidden'}
      </button>
    );
  }

  // ─── LIST VIEW ────────────────────────────────────────
  function ListView() {
    const allSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id));
    function toggleAll() {
      if (allSelected) {
        setSelectedIds((prev) => { const n = new Set(prev); products.forEach((p) => n.delete(p.id)); return n; });
      } else {
        setSelectedIds((prev) => { const n = new Set(prev); products.forEach((p) => n.add(p.id)); return n; });
      }
    }
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs font-medium">
            <tr>
              <th className="px-3 py-3 w-8">
                <input type="checkbox" checked={allSelected} onChange={toggleAll}
                  className="rounded border-gray-300 text-[#1B4F8A] focus:ring-[#1B4F8A]" />
              </th>
              <th className="px-2 py-3 w-12"></th>
              <SortHeader col="code"         label="Code"    className="text-left px-3 py-3 w-20" />
              <SortHeader col="name"         label="Product" className="text-left px-3 py-3" />
              <th className="text-left px-3 py-3 hidden md:table-cell text-gray-500">HSN/UOM</th>
              <SortHeader col="mrp"          label="MRP"     className="text-right px-3 py-3 hidden md:table-cell" />
              <SortHeader col="sellingPrice" label="Selling" className="text-right px-3 py-3" />
              <SortHeader col="stock"        label="Stock"   className="text-right px-3 py-3" />
              <SortHeader col="gstRatePercent" label="Tax"   className="text-left px-3 py-3 hidden lg:table-cell" />
              <th className="text-center px-3 py-3 text-gray-500 hidden lg:table-cell">Online</th>
              <th className="text-center px-3 py-3 text-gray-500">Status</th>
              <th className="px-3 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((p) => {
              const st = getStatus(p);
              const rowClass = st === 'DISABLED' ? 'opacity-50 bg-gray-50' : st === 'OUT_OF_STOCK' ? 'bg-red-50/30' : '';
              const checked = selectedIds.has(p.id);
              return (
                <tr key={p.id} className={`hover:bg-gray-50/80 transition-colors ${rowClass} ${checked ? 'bg-blue-50/40' : ''}`}>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={checked}
                      onChange={() => setSelectedIds((prev) => { const n = new Set(prev); checked ? n.delete(p.id) : n.add(p.id); return n; })}
                      className="rounded border-gray-300 text-[#1B4F8A] focus:ring-[#1B4F8A]" />
                  </td>
                  <td className="px-2 py-2">
                    <ProductImage imageUrl={p.imageUrl} updatedAt={p.updatedAt} size="thumb" alt={p.name}
                      productId={p.id}
                      onUpdated={() => queryClient.invalidateQueries({ queryKey: ['products'] })}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{p.productCode ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => openEdit(p)} className="font-medium text-sm leading-tight text-left text-[#1B4F8A] hover:underline cursor-pointer">{p.name}</button>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap"><CatBadge product={p} /><PluBadge product={p} onClick={() => openPluPanel(p)} /></div>
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-xs text-gray-500">
                    <HsnCell product={p} onUpdate={(hsn) => handleHsnUpdate(p.id, hsn)} />
                    <p className="mt-0.5">{p.unitOfMeasure}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right hidden md:table-cell text-sm text-gray-600">₹{fmt(p.defaultPlu?.mrp ?? p.mrp)}</td>
                  <td className="px-3 py-2.5 text-right text-sm font-medium text-[#1B4F8A]">₹{fmt(p.defaultPlu?.sellingPrice ?? p.sellingPrice)}</td>
                  <td className={`px-3 py-2.5 text-right text-sm font-medium ${stockColor(p)}`}>
                    {p.currentStock} <span className="text-xs font-normal text-gray-400">{p.unitOfMeasure}</span>
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell">
                    <TaxCell product={p} taxes={taxes} onUpdate={(tid) => handleTaxUpdate(p.id, tid)} />
                  </td>
                  <td className="px-3 py-2.5 text-center hidden lg:table-cell">
                    <OnlineToggle product={p} />
                  </td>
                  <td className="px-3 py-2.5 text-center"><StatusBadge product={p} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <ToggleBtn product={p} />
                      <button
                        onClick={() => router.push(`/dashboard/products/${p.id}/plu`)}
                        title="Manage PLU"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => router.push(`/dashboard/products/labels?id=${p.id}`)}
                        title="Print label"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                      >
                        <Tag className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B4F8A] hover:bg-blue-50 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openInNewWindow(`/dashboard/products?id=${p.id}`)}
                        title="Open in new window"
                        className="p-1.5 rounded-lg text-gray-300 hover:text-[#1B4F8A] hover:bg-blue-50 transition-colors text-sm leading-none"
                      >
                        ↗
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ─── COMPACT VIEW ─────────────────────────────────────
  function CompactView() {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full" style={{ fontSize: '12px' }}>
          <thead className="bg-gray-50 border-b border-gray-200 font-medium">
            <tr>
              <SortHeader col="code"           label="Code"    className="text-left px-2 py-2 w-16" />
              <SortHeader col="name"           label="Name"    className="text-left px-2 py-2" />
              <th className="text-left px-2 py-2 hidden md:table-cell text-gray-500 w-20">Cat</th>
              <SortHeader col="sellingPrice"   label="Selling" className="text-right px-2 py-2 w-20" />
              <SortHeader col="stock"          label="Stock"   className="text-right px-2 py-2 w-16" />
              <SortHeader col="gstRatePercent" label="Tax"     className="text-left px-2 py-2 hidden lg:table-cell w-24" />
              <th className="text-center px-2 py-2 text-gray-500 hidden xl:table-cell w-20">Online</th>
              <th className="text-center px-2 py-2 text-gray-500 w-24">Status</th>
              <th className="px-2 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((p) => {
              const st = getStatus(p);
              const rowClass = st === 'DISABLED' ? 'opacity-50' : '';
              return (
                <tr key={p.id} className={`hover:bg-gray-50 ${rowClass}`} style={{ lineHeight: '1.2' }}>
                  <td className="px-2 py-1.5"><span className="font-mono text-gray-500">{p.productCode ?? '—'}</span></td>
                  <td className="px-2 py-1.5 font-medium"><button onClick={() => openEdit(p)} className="text-left text-[#1B4F8A] hover:underline cursor-pointer">{p.name}</button></td>
                  <td className="px-2 py-1.5 hidden md:table-cell">
                    {p.category?.label && <span className="text-blue-600">{p.category.label}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium text-[#1B4F8A]">₹{fmt(p.defaultPlu?.sellingPrice ?? p.sellingPrice)}</td>
                  <td className={`px-2 py-1.5 text-right font-medium ${stockColor(p)}`}>{p.currentStock}</td>
                  <td className="px-2 py-1.5 hidden lg:table-cell">
                    <TaxCell product={p} taxes={taxes} onUpdate={(tid) => handleTaxUpdate(p.id, tid)} />
                  </td>
                  <td className="px-2 py-1.5 text-center hidden xl:table-cell">
                    <OnlineToggle product={p} />
                  </td>
                  <td className="px-2 py-1.5 text-center"><StatusBadge product={p} /></td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1 justify-end">
                      <ToggleBtn product={p} />
                      <button onClick={() => router.push(`/dashboard/products/${p.id}/plu`)} title="Manage PLU" className="text-gray-400 hover:text-indigo-600"><Layers className="w-3 h-3" /></button>
                      <button onClick={() => router.push(`/dashboard/products/labels?id=${p.id}`)} title="Print Label" className="text-gray-400 hover:text-purple-600"><Printer className="w-3 h-3" /></button>
                      <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-[#1B4F8A]"><Edit2 className="w-3 h-3" /></button>
                      <button
                        onClick={() => openInNewWindow(`/dashboard/products?id=${p.id}`)}
                        title="Open in new window"
                        className="text-gray-300 hover:text-[#1B4F8A] text-sm leading-none px-0.5"
                      >
                        ↗
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ─── CARD VIEW ────────────────────────────────────────
  function CardView() {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => {
          const st = getStatus(p);
          const reorder    = Number(p.reorderLevel);
          const maxForBar  = Math.max(reorder * 2, p.currentStock, 20);
          const barPct     = p.currentStock <= 0 ? 0 : Math.min(100, (p.currentStock / maxForBar) * 100);
          const barColor   = p.currentStock <= 0 ? 'bg-red-500' : p.currentStock <= reorder ? 'bg-amber-400' : 'bg-green-500';
          const cardBorder = st === 'OUT_OF_STOCK' ? 'border-red-300' : 'border-gray-200';
          return (
            <div
              key={p.id}
              className={`bg-white rounded-xl border p-4 flex flex-col gap-2 ${cardBorder} ${st === 'DISABLED' ? 'opacity-50' : ''}`}
            >
              {/* Header: code + status badge */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{p.productCode ?? '—'}</span>
                <StatusBadge product={p} />
              </div>

              {/* Name + short name */}
              <div>
                <button onClick={() => openEdit(p)} className="font-semibold leading-tight text-left text-[#1B4F8A] hover:underline cursor-pointer">{p.name}</button>
                {p.shortName && <p className="text-xs text-gray-400">{p.shortName}</p>}
              </div>

              {/* Category */}
              <div className="flex items-center gap-2 flex-wrap">
                <CatBadge product={p} />
                {p.barcode && <span className="text-xs text-gray-400 font-mono">{p.barcode}</span>}
              </div>

              {/* PLU + Category */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <PluBadge product={p} onClick={() => openPluPanel(p)} />
              </div>

              {/* Prices */}
              <div className="flex items-center gap-4 text-sm border-t border-gray-100 pt-2 mt-0.5">
                <div><p className="text-gray-400 text-xs">MRP</p><p className="font-medium text-gray-700">₹{fmt(p.defaultPlu?.mrp ?? p.mrp)}</p></div>
                <div><p className="text-gray-400 text-xs">Selling</p><p className="font-semibold text-[#1B4F8A]">₹{fmt(p.defaultPlu?.sellingPrice ?? p.sellingPrice)}</p></div>
                <div className="ml-auto">
                  <TaxCell product={p} taxes={taxes} onUpdate={(tid) => handleTaxUpdate(p.id, tid)} />
                </div>
              </div>

              {/* Stock + bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-400 text-xs">Stock</span>
                  <span className={`text-sm font-semibold ${stockColor(p)}`}>{p.currentStock} {p.unitOfMeasure}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barPct}%` }} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                <ToggleBtn product={p} />
                <button
                  onClick={() => router.push(`/dashboard/products/${p.id}/plu`)}
                  title="Manage PLU"
                  className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <Layers className="w-4 h-4" />
                </button>
                <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B4F8A] hover:bg-blue-50 transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openInNewWindow(`/dashboard/products?id=${p.id}`)}
                  title="Open in new window"
                  className="p-1.5 rounded-lg text-gray-300 hover:text-[#1B4F8A] hover:bg-blue-50 transition-colors text-sm leading-none"
                >
                  ↗
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────
  function EmptyState() {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">No products found</p>
        {chips.length > 0 && <button onClick={clearAll} className="mt-2 text-xs text-[#1B4F8A] hover:underline">Clear filters</button>}
      </div>
    );
  }

  // ─── Skeleton ─────────────────────────────────────────
  function Skeleton() {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-2">
        {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
      </div>
    );
  }

  // ─── RENDER ───────────────────────────────────────────
  return (
    <>
      <Header
        title="Products"
        actions={
          <span className={`text-xs font-medium ${connected ? 'text-green-600' : 'text-gray-400'}`}>
            {connected ? '● Live' : '○ Offline'}
          </span>
        }
      />
      <main className="flex-1 p-6 space-y-3">

        {/* ── Toolbar Row 1: Search + Sort + View ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <BarcodeScannerInput
            value={search} onChange={setSearch}
            placeholder="Search products, code or scan barcode…"
            inputClassName="pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] w-56"
          />

          {/* Department → Category → Sub-category filter */}
          <select
            value={filterDeptId ?? ''}
            onChange={(e) => { setFilterDeptId(e.target.value); setMainCatId(''); setSubCatId(''); }}
            className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
          >
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={mainCatId} onChange={(e) => { setMainCatId(e.target.value); setSubCatId(''); }}
            className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]">
            <option value="">All Categories</option>
            {filterCatsByDept.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select
            value={subCatId}
            onChange={(e) => setSubCatId(e.target.value)}
            disabled={!mainCatId || subCats.length === 0}
            className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <option value="">All Sub-categories</option>
            {subCats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>

          <span className="text-xs text-gray-400 ml-auto">{total} product{total !== 1 ? 's' : ''}</span>

          {/* Sort */}
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}
            className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]">
            {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {/* View toggle */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            {([['list', List], ['card', LayoutGrid], ['compact', AlignJustify]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => setViewPersist(v)}
                className={`p-2 ${view === v ? 'bg-[#1B4F8A] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'} transition-colors`}
                title={v.charAt(0).toUpperCase() + v.slice(1)}>
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          <button onClick={() => router.push('/dashboard/products/labels')}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            <Printer className="w-4 h-4" /> Print Labels
          </button>
          <button onClick={() => openInNewWindow('/dashboard/products/groups')}
            className="flex items-center gap-1.5 border border-purple-200 text-purple-700 text-sm font-medium px-3 py-2 rounded-lg hover:bg-purple-50 transition-colors">
            Groups
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 bg-[#1B4F8A] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#163f6e] transition-colors">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>

        {/* ── Filter Row 2 ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)}
            className="py-1.5 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]">
            <option value="">All Brands</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={productType} onChange={(e) => setProductType(e.target.value)}
            className="py-1.5 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]">
            <option value="">All Types</option>
            {PRODUCT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="py-1.5 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]">
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)}
            className="py-1.5 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]">
            {STOCK_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={gstRate} onChange={(e) => setGstRate(e.target.value)}
            className="py-1.5 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]">
            {GST_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          <button
            onClick={() => setHsnFilter(hsnFilter === 'UNSET' ? '' : 'UNSET')}
            className={`py-1.5 px-2.5 text-xs rounded-lg border transition-colors whitespace-nowrap ${
              hsnFilter === 'UNSET'
                ? 'bg-amber-100 border-amber-400 text-amber-700 font-medium'
                : 'border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-600'
            }`}
          >
            HSN Unset
          </button>
          <select
            value={imageFilter}
            onChange={(e) => { setImageFilter(e.target.value); setPage(1); }}
            className={`py-1.5 px-2 text-xs rounded-lg border transition-colors focus:outline-none focus:border-[#1B4F8A] ${
              imageFilter ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'
            }`}
          >
            <option value="">All (Image)</option>
            <option value="WITH_IMAGE">📷 With Image</option>
            <option value="WITHOUT_IMAGE">🚫 No Image</option>
          </select>
          {chips.length > 0 && (
            <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700 ml-1">Clear All</button>
          )}
        </div>

        {/* ── Filter chips ── */}
        {chips.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {chips.map((ch, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                {ch.label}
                <button onClick={ch.clear} className="hover:text-red-500"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}

        {/* ── Product data ── */}
        {isLoading ? <Skeleton /> :
          products.length === 0 ? <EmptyState /> :
          view === 'card' ? <CardView /> :
          view === 'compact' ? <CompactView /> :
          <ListView />}

        {/* ── Pagination ── */}
        {totalPages > 1 && (() => {
          // Windowed pages: current ± 2, with first/last + ellipses.
          const win = 2;
          const pages: (number | '…')[] = [];
          const lo = Math.max(1, page - win);
          const hi = Math.min(totalPages, page + win);
          if (lo > 1) { pages.push(1); if (lo > 2) pages.push('…'); }
          for (let i = lo; i <= hi; i++) pages.push(i);
          if (hi < totalPages) { if (hi < totalPages - 1) pages.push('…'); pages.push(totalPages); }
          const btn = 'h-8 min-w-8 px-2 rounded text-sm font-medium transition-colors';
          return (
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <span className="text-xs text-gray-400 mr-2">{total.toLocaleString('en-IN')} products · page {page} of {totalPages}</span>
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className={`${btn} bg-white text-gray-600 border border-gray-200 hover:border-[#1B4F8A] disabled:opacity-40`}>‹ Prev</button>
              {pages.map((p, i) => p === '…'
                ? <span key={`e${i}`} className="px-1 text-gray-400">…</span>
                : <button key={p} onClick={() => setPage(p)}
                    className={`${btn} ${p === page ? 'bg-[#1B4F8A] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#1B4F8A]'}`}>{p}</button>
              )}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                className={`${btn} bg-white text-gray-600 border border-gray-200 hover:border-[#1B4F8A] disabled:opacity-40`}>Next ›</button>
            </div>
          );
        })()}
      </main>

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-2 sm:p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-[95vw] max-w-[1200px] shadow-2xl flex flex-col" style={{ maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>

            {/* Sticky header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <h2 className="text-base font-semibold text-gray-800">{editing ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-6">
              {showRestore && !editing && (() => {
                const saved = autosave.getSaved();
                return saved ? (
                  <div className="mb-4">
                    <RestoreBanner
                      savedAt={saved.savedAt}
                      onRestore={() => { setForm(saved.data); setShowRestore(false); }}
                      onDiscard={() => { autosave.clearSaved(); setShowRestore(false); }}
                    />
                  </div>
                ) : null;
              })()}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                {/* ── Basic Information ── */}
                <SectionDivider label="Basic Information" />

                {/* Product Name — full width */}
                <div className="col-span-2 lg:col-span-4">
                  <Fld label="Product Name *" help={{
                    hint: 'Use full descriptive name with size',
                    title: 'Product Name',
                    description: 'Enter the complete product name including brand, variant, and size. This appears on bills and reports.',
                    example: 'Example: Fortune Sunflower Oil 1L',
                  }}>
                    <input value={form.name}
                      onChange={(e) => {
                        const corrected = applyLiveCorrection(e.target.value);
                        setForm((f) => ({
                          ...f,
                          name: corrected,
                          shortName: !shortNameEdited ? corrected.trim().slice(0, 40) : f.shortName,
                        }));
                      }}
                      onBlur={(e) => setForm((f) => ({ ...f, name: toTitleCase(cleanSpaces(e.target.value)) }))}
                      className="inp" placeholder="Enter product name" />
                    {/\b(\d+\s*(ml|l|ltr|litre|kg|g|gm|gram|mtr|m|cm|pcs|pc|nos|no|pack|pkt|box|bag|btl|bottle|can|dozen|doz|set))\b/i.test(form.name) && form.unitOfMeasure === 'PCS' && (
                      <div className="mt-1.5 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
                        <span className="text-blue-500 shrink-0 mt-0.5">ℹ</span>
                        <p className="text-xs text-blue-700">
                          The name includes a measurement. If this is a <b>packaged item</b> (e.g. a 500ml bottle sold as 1 unit), keep UOM as <b>PCS</b> — that's correct. Only change UOM to KG/LTR if you sell this product loose by weight/volume at the counter.
                        </p>
                      </div>
                    )}
                    {!editing && dupMatches.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <p className="text-xs text-amber-700 flex-1">
                          {dupMatches.length} similar product{dupMatches.length > 1 ? 's' : ''} already exist.
                        </p>
                        <button type="button" onClick={() => setShowDupModal(true)}
                          className="text-xs text-amber-700 underline font-medium shrink-0">View</button>
                      </div>
                    )}
                  </Fld>
                </div>

                {/* Short Name */}
                <Fld label="Short Name" help={{
                  hint: 'Abbreviation for thermal receipts (limited space)',
                  title: 'Short Name',
                  description: 'A shorter version of the product name used on 80mm thermal receipts where space is limited.',
                  example: 'Example: Fortune Oil 1L',
                }}>
                  <input value={form.shortName}
                    onChange={(e) => { setShortNameEdited(true); setForm({ ...form, shortName: e.target.value }); }}
                    onBlur={(e) => setForm((f) => ({ ...f, shortName: toTitleCase(cleanSpaces(e.target.value)) }))}
                    className="inp" placeholder="Abbrev" />
                </Fld>

                {/* Barcode */}
                <Fld label="Barcode" help={{
                  hint: 'Scan barcode from packaging or leave blank for auto-assign',
                  title: 'Barcode / EAN Code',
                  description: 'Scan the barcode from the product packaging. If left blank, the PLU code will be automatically assigned as barcode and printed on your store labels.',
                  example: 'Example: 8901234567890',
                }}>
                  <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value.replace(/\s/g, '') })} className="inp" placeholder="Scan or enter" />
                  {!(form as any).barcode && !editing && (
                    <div className="mt-1.5 flex items-start gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
                      <Info className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-700">PLU code will be auto-assigned as barcode.</p>
                    </div>
                  )}
                </Fld>

                {/* Brand */}
                <Fld label="Brand">
                  <div className="relative" ref={brandDropRef}>
                    <button
                      type="button"
                      onClick={() => { setShowBrandDrop((v) => !v); setBrandSearch(''); }}
                      className="inp text-left flex items-center justify-between"
                    >
                      <span className={`truncate ${(form as any).brandId ? 'text-gray-800' : 'text-gray-400'}`}>
                        {brands.find((b) => b.id === (form as any).brandId)?.name ?? 'Select brand…'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
                    </button>
                    {showBrandDrop && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl">
                        <div className="p-1.5 border-b border-gray-100">
                          <input autoFocus value={brandSearch} onChange={(e) => setBrandSearch(e.target.value)}
                            placeholder="Search brand…"
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#1B4F8A]" />
                        </div>
                        <div className="max-h-36 overflow-y-auto">
                          {(form as any).brandId && (
                            <button type="button" onClick={() => { setForm((f: any) => ({ ...f, brandId: '' })); setShowBrandDrop(false); }}
                              className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50">— None —</button>
                          )}
                          {filteredBrandsInDrop.map((b) => (
                            <button key={b.id} type="button"
                              onClick={() => { setForm((f: any) => ({ ...f, brandId: b.id })); setShowBrandDrop(false); }}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 ${b.id === (form as any).brandId ? 'bg-blue-50 font-medium text-[#1B4F8A]' : 'text-gray-800'}`}>
                              {b.name}
                            </button>
                          ))}
                        </div>
                        <div className="border-t border-gray-100 p-1.5">
                          <button type="button" onClick={() => { setShowBrandDrop(false); setShowBrandModal(true); }}
                            className="w-full text-left px-3 py-1.5 text-xs text-[#1B4F8A] hover:bg-blue-50 rounded font-medium">
                            + Add New Brand
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </Fld>

                {/* Product Type */}
                <Fld label="Product Type">
                  <select value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })} className="inp">
                    {PRODUCT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Fld>

                {/* ── Classification ── */}
                <SectionDivider label="Classification" />

                {/* Department */}
                <Fld label="Department *" help={{
                  hint: 'Top-level product classification',
                  title: 'Department',
                  description: 'Select the department this product belongs to. This filters the category list below.',
                }}>
                  <div className="flex gap-1.5">
                    <select value={(form as any).departmentId}
                      onChange={(e) => setForm({ ...form, departmentId: e.target.value, mainCategoryId: '', categoryId: '' } as any)}
                      className="inp flex-1">
                      <option value="">— Select department —</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <button type="button" onClick={() => { setQuickAdd('dept'); setQuickAddName(''); }}
                      title="Add new department" className="px-2.5 py-1 text-sm bg-gray-100 hover:bg-[#1B4F8A] hover:text-white text-gray-600 rounded-lg border border-gray-200 transition-colors font-bold shrink-0">+</button>
                  </div>
                </Fld>

                {/* Category */}
                <Fld label="Category *" help={{
                  hint: 'Filtered by department',
                  title: 'Category',
                  description: 'Select the category within the chosen department.',
                }}>
                  <div className="flex gap-1.5">
                    <select value={form.mainCategoryId}
                      onChange={(e) => setForm({ ...form, mainCategoryId: e.target.value, categoryId: '' })}
                      className="inp flex-1" disabled={!(form as any).departmentId}>
                      <option value="">— Select category —</option>
                      {formCatsByDept.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <button type="button" onClick={() => { setQuickAdd('cat'); setQuickAddName(''); }}
                      disabled={!(form as any).departmentId}
                      title="Add new category" className="px-2.5 py-1 text-sm bg-gray-100 hover:bg-[#1B4F8A] hover:text-white text-gray-600 rounded-lg border border-gray-200 transition-colors font-bold shrink-0 disabled:opacity-40">+</button>
                  </div>
                </Fld>

                {/* Sub-Category */}
                <Fld label="Sub-Category *">
                  <div className="flex gap-1.5">
                    <select value={form.categoryId}
                      onChange={(e) => {
                        const selSub = formSubCats.find((c) => c.id === e.target.value);
                        setForm({
                          ...form,
                          categoryId: e.target.value,
                          // Auto-fill HSN from subcategory if current HSN is blank or still "0000"
                          ...((selSub?.hsnCode && (!form.hsnCode || form.hsnCode === '0000'))
                            ? { hsnCode: selSub.hsnCode }
                            : {}),
                        });
                      }}
                      className="inp flex-1" disabled={!form.mainCategoryId || formSubCats.length === 0}>
                      <option value="">— Select sub-category —</option>
                      {formSubCats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <button type="button" onClick={() => { setQuickAdd('sub'); setQuickAddName(''); }}
                      disabled={!form.mainCategoryId}
                      title="Add new sub-category" className="px-2.5 py-1 text-sm bg-gray-100 hover:bg-[#1B4F8A] hover:text-white text-gray-600 rounded-lg border border-gray-200 transition-colors font-bold shrink-0 disabled:opacity-40">+</button>
                  </div>
                </Fld>

                {/* HSN Code */}
                <Fld label="HSN Code *" help={{
                  hint: '6-8 digit government commodity code',
                  title: 'HSN Code (Harmonized System of Nomenclature)',
                  description: 'Mandatory for GST. This code identifies your product category for tax purposes. Check your supplier invoice or GST rate chart.',
                  example: 'Example: 1512 (Sunflower oil), 3306 (Toothpaste)',
                }}>
                  <input value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value.replace(/\D/g, '').slice(0, 8) })} className="inp" placeholder="e.g. 150890 (4, 6 or 8 digits)" />
                </Fld>

                {/* ── Pricing ── */}
                <SectionDivider label="Pricing" />

                {editing && (editing.activePluCount ?? 0) > 0 ? (
                  <>
                    {/* PLU lock banner — full width */}
                    <div className="col-span-2 lg:col-span-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                      <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-amber-800">
                        <span className="font-medium">Prices managed via PLU.</span>{' '}
                        MRP, Selling Price and Cost Price are locked here.{' '}
                        <button type="button" onClick={() => openPluPanel(editing)}
                          className="underline font-semibold hover:text-amber-900">Manage PLU</button>
                      </div>
                    </div>
                    <Fld label="MRP (₹)">
                      <input type="number" value={form.mrp} readOnly className="inp bg-gray-50 text-gray-500 cursor-default" />
                    </Fld>
                    <Fld label="Selling Price (₹)">
                      <input type="number" value={form.sellingPrice} readOnly className="inp bg-gray-50 text-gray-500 cursor-default" />
                    </Fld>
                    <Fld label="Cost Price (₹)">
                      <input type="number" value={form.costPrice} readOnly className="inp bg-gray-50 text-gray-500 cursor-default" />
                    </Fld>
                    <Fld label="Tax Slab *" help={{
                      hint: 'GST rate applicable to this product',
                      title: 'Tax Slab',
                      description: 'Select the GST rate for this product. This is shown on bills and used for GST filing.',
                      example: 'Examples: 0% (vegetables), 5% (oil, dal), 12% (biscuits), 18% (soap), 28% (cold drinks)',
                    }}>
                      <select value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} className="inp">
                        <option value="">— Select tax —</option>
                        {taxes.map((t) => <option key={t.id} value={t.id}>{t.taxName} ({t.taxRate}%)</option>)}
                      </select>
                    </Fld>
                    <Fld label="CESS Rate %" help={{
                      hint: 'Additional cess on top of GST (cold drinks: 12%)',
                      title: 'CESS Rate %',
                      description: 'Compensation Cess is an additional tax on certain goods. Set to 0 for most products.',
                      example: 'Pepsi/Coke: 12%, Cigarettes: varies, Others: 0%',
                    }}>
                      <input type="number" min={0} max={100} step="0.01" value={form.cessRate}
                        onChange={(e) => setForm({ ...form, cessRate: e.target.value })} className="inp" placeholder="0" />
                    </Fld>
                  </>
                ) : (
                  <>
                    <Fld label="MRP (₹) *" help={{
                      hint: 'Maximum price printed on packet (legal ceiling)',
                      title: 'MRP (Maximum Retail Price)',
                      description: 'The price printed on the product packaging. You cannot charge customers MORE than MRP. This is legally enforced.',
                    }}>
                      <input type="number" value={form.mrp}
                        onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                        onBlur={() => {
                          if (form.sellingPrice && form.mrp && Number(form.sellingPrice) > Number(form.mrp))
                            setSellingPriceError('Selling price cannot exceed MRP');
                          else setSellingPriceError('');
                        }}
                        className="inp" min={0} step="0.01" />
                    </Fld>
                    <Fld label="Selling Price (₹) *" help={{
                      hint: 'Your actual selling price (must be <= MRP)',
                      title: 'Selling Price',
                      description: 'The price at which you sell to retail customers. Must not exceed MRP.',
                    }}>
                      <input type="number" value={form.sellingPrice}
                        onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                        onBlur={() => {
                          if (form.mrp && Number(form.sellingPrice) > Number(form.mrp))
                            setSellingPriceError('Selling price cannot exceed MRP');
                          else setSellingPriceError('');
                        }}
                        className={`inp ${sellingPriceError ? 'border-red-400' : ''}`} min={0} step="0.01" />
                      {sellingPriceError && <p className="text-xs text-red-500 mt-0.5">{sellingPriceError}</p>}
                    </Fld>
                    <Fld label="Cost Price (₹)" help={{
                      hint: 'Your purchase cost (used for profit calculation)',
                      title: 'Cost Price',
                      description: 'What you pay to buy this product. Used internally for profit reports. Updated automatically from GRN.',
                    }}>
                      <input type="number" value={form.costPrice}
                        onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                        onBlur={() => {
                          if (form.costPrice && form.sellingPrice && Number(form.costPrice) > Number(form.sellingPrice))
                            setCostPriceWarn('Cost price exceeds selling price — margin negative');
                          else setCostPriceWarn('');
                        }}
                        className={`inp ${costPriceWarn ? 'border-amber-400' : ''}`} min={0} step="0.01" />
                      {costPriceWarn && <p className="text-xs text-amber-600 mt-0.5">{costPriceWarn}</p>}
                    </Fld>
                    <Fld label="Tax Slab *" help={{
                      hint: 'GST rate applicable to this product',
                      title: 'Tax Slab',
                      description: 'Select the GST rate for this product. This is shown on bills and used for GST filing.',
                      example: 'Examples: 0% (fresh vegetables), 5% (oil, dal), 12% (biscuits), 18% (soap), 28% (cold drinks)',
                    }}>
                      <select value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} className="inp">
                        <option value="">— Select tax —</option>
                        {taxes.map((t) => <option key={t.id} value={t.id}>{t.taxName} ({t.taxRate}%)</option>)}
                      </select>
                    </Fld>
                    <Fld label="CESS Rate %" help={{
                      hint: 'Additional cess on top of GST (cold drinks: 12%)',
                      title: 'CESS Rate %',
                      description: 'Compensation Cess is an additional tax on certain goods. Set to 0 for most products.',
                      example: 'Pepsi/Coke: 12%, Cigarettes: varies, Others: 0%',
                    }}>
                      <input type="number" min={0} max={100} step="0.01" value={form.cessRate}
                        onChange={(e) => setForm({ ...form, cessRate: e.target.value })} className="inp" placeholder="0" />
                    </Fld>
                  </>
                )}

                {/* ── Units & Measurements ── */}
                <SectionDivider label="Units & Measurements" />

                <Fld label="Unit of Measure">
                  <select value={form.unitOfMeasure} onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })} className="inp">
                    {[
                      { v: 'PCS', l: 'PCS — Pieces (default for packaged goods)' },
                      { v: 'KG',  l: 'KG — Kilograms' },
                      { v: 'G',   l: 'G — Grams' },
                      { v: 'LTR', l: 'LTR — Litres' },
                      { v: 'ML',  l: 'ML — Millilitres' },
                      { v: 'MTR', l: 'MTR — Metres' },
                      { v: 'BTL', l: 'BTL — Bottles' },
                      { v: 'BOX', l: 'BOX — Boxes' },
                      { v: 'PKT', l: 'PKT — Packets' },
                      { v: 'BAG', l: 'BAG — Bags' },
                      { v: 'CAN', l: 'CAN — Cans' },
                      { v: 'DOZ', l: 'DOZ — Dozen' },
                      { v: 'SET', l: 'SET — Sets' },
                    ].map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Use <b>PCS</b> for all packaged items (500ml bottle, 1kg bag) — the size is in the product name. Use KG/LTR only for loose/bulk items sold by weight or volume at the counter.
                  </p>
                </Fld>

                <Fld label="Purchase Unit">
                  <select value={form.purchaseUnit} onChange={(e) => setForm({ ...form, purchaseUnit: e.target.value })} className="inp">
                    {PURCH_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Fld>

                <Fld label="Stock Unit">
                  <select value={form.stockUnit} onChange={(e) => setForm({ ...form, stockUnit: e.target.value })} className="inp">
                    {STOCK_OPTIONS_UNIT.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Fld>

                <Fld label="Pack Size (Pcs/Case)" help={{
                  hint: 'How many pieces come in one case/carton',
                  title: 'Pieces Per Case',
                  description: 'The standard number of pieces in one carton or case from your supplier. Auto-fills in GRN to calculate quantities quickly.',
                  example: 'Example: 12 (one case = 12 bottles)',
                }}>
                  <input type="number" min={1} value={form.defaultPackSize}
                    onChange={(e) => setForm({ ...form, defaultPackSize: e.target.value })} className="inp" placeholder="1" />
                </Fld>

                {/* ── Stock Settings ── */}
                <SectionDivider label="Stock Settings" />

                <Fld label="Reorder Level">
                  <input type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} className="inp" min={0} />
                </Fld>

                <Fld label="Reorder Quantity" help={{
                  hint: 'How many to order when restocking',
                  title: 'Reorder Quantity',
                  description: 'The suggested quantity to order when this product needs restocking.',
                  example: 'Example: 96 (8 cases of 12 each)',
                }}>
                  <input type="number" min={0} value={form.reorderQuantity}
                    onChange={(e) => setForm({ ...form, reorderQuantity: e.target.value })} className="inp" placeholder="0" />
                </Fld>

                <Fld label="Minimum Stock Level" help={{
                  hint: 'Alert threshold — get notified when stock falls below this',
                  title: 'Minimum Stock Level',
                  description: 'When stock falls below this number, you receive a LOW STOCK alert.',
                  example: 'Example: If you sell 10 per day and delivery takes 3 days, set minimum to 30',
                }}>
                  <input type="number" min={0} value={form.minimumStockLevel}
                    onChange={(e) => setForm({ ...form, minimumStockLevel: e.target.value })} className="inp" placeholder="0" />
                </Fld>

                <div /> {/* blank column placeholder */}

                {/* Toggle cards */}
                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-gray-700">Expiry Tracking</p>
                    <p className="text-xs text-gray-400">Dairy, food, beverages</p>
                  </div>
                  <button type="button" onClick={() => setForm({ ...form, expiryTracking: !form.expiryTracking })}
                    className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ml-2 ${form.expiryTracking ? 'bg-[#1B4F8A]' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.expiryTracking ? 'translate-x-4' : ''}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-gray-700">Negative Stock</p>
                    <p className="text-xs text-gray-400">Bill when stock zero</p>
                  </div>
                  <button type="button" onClick={() => setForm({ ...form, allowNegativeStock: !form.allowNegativeStock })}
                    className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ml-2 ${form.allowNegativeStock ? 'bg-[#1B4F8A]' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.allowNegativeStock ? 'translate-x-4' : ''}`} />
                  </button>
                </div>

                {isManager && (
                  <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                    <div>
                      <p className="text-xs font-medium text-amber-800">Allow Below Minimum Margin</p>
                      <p className="text-xs text-amber-600">Exception — lets price &amp; sell below the min-margin rule</p>
                    </div>
                    <button type="button" onClick={() => setForm({ ...form, allowBelowMargin: !form.allowBelowMargin })}
                      className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ml-2 ${form.allowBelowMargin ? 'bg-amber-500' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.allowBelowMargin ? 'translate-x-4' : ''}`} />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-gray-700">Returnable</p>
                    <p className="text-xs text-gray-400">Customer returns allowed</p>
                  </div>
                  <button type="button" onClick={() => setForm({ ...form, isReturnable: !form.isReturnable })}
                    className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ml-2 ${form.isReturnable ? 'bg-[#1B4F8A]' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isReturnable ? 'translate-x-4' : ''}`} />
                  </button>
                </div>

                <div /> {/* blank column placeholder */}

                {/* ── Other ── */}
                <SectionDivider label="Other" />

                {/* Return period / non-returnable reason */}
                {form.isReturnable ? (
                  <Fld label="Return Period (days)">
                    <input type="number" min={1} max={365} value={form.returnPeriodDays}
                      onChange={(e) => setForm({ ...form, returnPeriodDays: e.target.value })}
                      className="inp" placeholder="7" />
                  </Fld>
                ) : (
                  <Fld label="Non-Returnable Reason">
                    <input type="text" value={form.nonReturnableReason}
                      onChange={(e) => setForm({ ...form, nonReturnableReason: e.target.value })}
                      className="inp" placeholder="e.g. Perishable item, hygiene product..." />
                  </Fld>
                )}

                {/* Active toggle (edit mode only) */}
                {editing ? (
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                    <p className="text-xs font-medium text-gray-700">Active</p>
                    <button type="button" onClick={() => setForm({ ...form, isActive: !form.isActive })}
                      className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ml-2 ${form.isActive ? 'bg-[#1B4F8A]' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-4' : ''}`} />
                    </button>
                  </div>
                ) : <div />}

                {/* ── Image ── */}
                <SectionDivider label="Image" />

                <div className="col-span-2 lg:col-span-4">
                  {editing ? (
                    <div className="flex items-start gap-4">
                      <div className="w-24 h-24 rounded-lg border border-gray-200 overflow-hidden shrink-0 bg-gray-50">
                        <ProductImage imageUrl={editing.imageUrl} updatedAt={editing.updatedAt} size="large" alt={editing.name}
                          productId={editing.id}
                          onUpdated={() => queryClient.invalidateQueries({ queryKey: ['products'] })}
                        />
                      </div>
                      <div className="flex flex-col gap-2 pt-1">
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
                              const res = await api.post(`/products/${editing.id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                              setEditing(prev => prev ? { ...prev, imageUrl: res.data.imageUrl, updatedAt: new Date().toISOString() } : null);
                              queryClient.invalidateQueries({ queryKey: ['products'] });
                              toast.success('Image updated');
                            } catch (err: any) {
                              toast.error(err?.response?.data?.message ?? 'Image upload failed');
                            } finally {
                              setUploadingImage(false);
                              if (imageInputRef.current) imageInputRef.current.value = '';
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50"
                        >
                          {uploadingImage ? 'Uploading…' : editing.imageUrl ? 'Replace Image' : 'Upload Image'}
                        </button>
                        {editing.imageUrl && (
                          <button
                            type="button"
                            disabled={uploadingImage}
                            onClick={async () => {
                              setUploadingImage(true);
                              try {
                                await api.delete(`/products/${editing.id}/image`);
                                setEditing(prev => prev ? { ...prev, imageUrl: null } : null);
                                queryClient.invalidateQueries({ queryKey: ['products'] });
                                toast.success('Image removed');
                              } catch {
                                toast.error('Failed to remove image');
                              } finally { setUploadingImage(false); }
                            }}
                            className="text-xs px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 text-red-600 disabled:opacity-50"
                          >
                            Remove Image
                          </button>
                        )}
                        <p className="text-xs text-gray-400">JPG, PNG or WebP · max 2 MB</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <div className="w-24 h-24 rounded-lg border border-gray-200 overflow-hidden shrink-0 bg-gray-50 flex items-center justify-center">
                        {pendingImagePreview
                          ? <img src={pendingImagePreview} alt="Preview" className="w-full h-full object-contain" />
                          : <img src="/noimage.svg" alt="" className="w-full h-full object-contain" />
                        }
                      </div>
                      <div className="flex flex-col gap-2 pt-1">
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setPendingImage(file);
                            setPendingImagePreview(URL.createObjectURL(file));
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                        >
                          {pendingImage ? 'Change Image' : 'Choose Image'}
                        </button>
                        {pendingImage && (
                          <button
                            type="button"
                            onClick={() => { setPendingImage(null); setPendingImagePreview(null); if (imageInputRef.current) imageInputRef.current.value = ''; }}
                            className="text-xs px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 text-red-600"
                          >
                            Remove
                          </button>
                        )}
                        <p className="text-xs text-gray-400">JPG, PNG or WebP · max 2 MB · uploaded after save</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Search Keywords & Description ── */}
                <SectionDivider label="Search Keywords & Description" />

                <div className="col-span-2 lg:col-span-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-700">
                      Search Keywords
                      <span className="text-gray-400 font-normal ml-1">— help find this product in search (synonyms, brand, local names)</span>
                    </label>
                    {(form as any).keywords && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...(f as any), keywords: '' }))}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <textarea
                    value={(form as any).keywords ?? ''}
                    onChange={(e) => setForm({ ...(form as any), keywords: e.target.value })}
                    rows={2}
                    placeholder="e.g. atta wheat flour chakki gehun aashirvad 5kg staples grains"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] resize-y"
                  />
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Space-separated words. Include brand, category, size variants, and local/Hindi names so the product shows up for any search term.
                  </p>
                </div>

                <div className="col-span-2 lg:col-span-4">
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Description
                    <span className="text-gray-400 font-normal ml-1">— shown on storefront / product detail</span>
                  </label>
                  <textarea
                    value={(form as any).description ?? ''}
                    onChange={(e) => setForm({ ...(form as any), description: e.target.value })}
                    rows={2}
                    placeholder="Short description of the product"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] resize-y"
                  />
                </div>

              </div>{/* end grid */}
            </div>{/* end scrollable body */}

            {/* Sticky footer */}
            {sourceGrn && !editing && (
              <div className="px-6 pt-3 shrink-0">
                <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                  Adding Product for GRN — window will close automatically after save.
                </p>
              </div>
            )}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 shrink-0">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving}
                className="flex-1 py-2.5 text-sm font-medium bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163f6e] disabled:opacity-60 flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                {saving ? 'Saving…' : editing ? 'Update' : sourceGrn ? 'Save & Close' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dup Check Modal ── */}
      {showDupModal && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setShowDupModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Similar Products Found</h2>
              <button onClick={() => setShowDupModal(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-xs text-gray-500">The following products have similar names. Check before adding to avoid duplicates.</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {dupMatches.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{p.productCode ?? '—'}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowDupModal(false)}
              className="w-full py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-xl font-medium text-gray-700">
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Quick-Add Modal (Dept / Cat / Sub) ── */}
      {quickAdd && (
        <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4" onClick={() => { setQuickAdd(null); setQuickAddName(''); }}>
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">
                {quickAdd === 'dept' ? 'Add Department' : quickAdd === 'cat' ? 'Add Category' : 'Add Sub-Category'}
              </h2>
              <button onClick={() => { setQuickAdd(null); setQuickAddName(''); }} className="p-1 rounded hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Name *</label>
              <input
                autoFocus
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveQuickAdd()}
                className="inp"
                placeholder={quickAdd === 'dept' ? 'e.g. Beverages' : quickAdd === 'cat' ? 'e.g. Cold Drinks' : 'e.g. Carbonated Drinks'}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setQuickAdd(null); setQuickAddName(''); }}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={saveQuickAdd} disabled={savingQuickAdd || !quickAddName.trim()}
                className="flex-1 py-2 text-sm bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163f6e] disabled:opacity-60 flex items-center justify-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {savingQuickAdd ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Brand Mini Modal ── */}
      {showBrandModal && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => { setShowBrandModal(false); setNewBrandName(''); }}>
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Add New Brand</h2>
              <button onClick={() => { setShowBrandModal(false); setNewBrandName(''); }} className="p-1 rounded hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Brand Name *</label>
              <input
                autoFocus
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveNewBrand()}
                className="inp"
                placeholder="e.g. Fortune, Tropicana"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowBrandModal(false); setNewBrandName(''); }}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={saveNewBrand} disabled={savingBrand || !newBrandName.trim()}
                className="flex-1 py-2 text-sm bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163f6e] disabled:opacity-60 flex items-center justify-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {savingBrand ? 'Saving…' : 'Save Brand'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Disable Confirm Modal ── */}
      {disableTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDisableTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Ban className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Disable Product?</h3>
                <p className="text-sm text-gray-500">{disableTarget.name}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              This product will be hidden from POS billing.
              {disableTarget.currentStock > 0 && (
                <span className="block mt-1 text-amber-700 font-medium">
                  {disableTarget.currentStock} {disableTarget.unitOfMeasure} still in stock.
                </span>
              )}
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDisableTarget(null)} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => handleToggle(disableTarget, 'DISABLE')}
                disabled={toggleMutation.isPending}
                className="flex-1 py-2.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-60"
              >
                {toggleMutation.isPending ? 'Disabling…' : 'Disable Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-3 flex-wrap max-w-[90vw]">
          <span className="text-sm font-semibold whitespace-nowrap">
            {selectedIds.size} product{selectedIds.size !== 1 ? 's' : ''} selected
          </span>

          {/* Online visibility bulk actions */}
          <button
            onClick={() => bulkOnlineMutation.mutate({ ids: Array.from(selectedIds), online: true })}
            disabled={bulkOnlineMutation.isPending}
            className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 whitespace-nowrap"
            title="Show selected products on storefront"
          >
            {bulkOnlineMutation.isPending && (bulkOnlineMutation.variables as any)?.online === true
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Globe className="w-3 h-3" />
            }
            Mark Online
          </button>
          <button
            onClick={() => bulkOnlineMutation.mutate({ ids: Array.from(selectedIds), online: false })}
            disabled={bulkOnlineMutation.isPending}
            className="flex items-center gap-1.5 bg-gray-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-gray-500 transition-colors disabled:opacity-50 whitespace-nowrap"
            title="Hide selected products from storefront"
          >
            {bulkOnlineMutation.isPending && (bulkOnlineMutation.variables as any)?.online === false
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <GlobeLock className="w-3 h-3" />
            }
            Mark Offline
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-600" />

          {/* Label print */}
          <button
            onClick={() => router.push(`/dashboard/products/labels?ids=${Array.from(selectedIds).join(',')}`)}
            className="flex items-center gap-1.5 bg-purple-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-purple-700 transition-colors whitespace-nowrap"
          >
            <Tag className="w-3 h-3" /> Print Labels
          </button>

          {/* Clear */}
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-gray-400 hover:text-white transition-colors ml-1"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── PLU Quick-View Panel ── */}
      {pluPanel && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="flex-1 bg-black/30" onClick={() => setPluPanel(null)} />
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h2 className="font-bold text-gray-900 text-sm">{pluPanel.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{pluPanel.productCode} · PLU / Price Management</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowPluPanelAdd(true); setPluPanelEditId(null); setPluPanelAddForm({ mrp: '', sellingPrice: '', gstRate: String(pluPanelTaxRates[0]?.taxRate ?? ''), cessRate: '0', packLabel: '' }); }}
                  className="text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 px-2.5 py-1 rounded-lg font-medium transition-colors"
                >+ Add PLU</button>
                <button onClick={() => { router.push(`/dashboard/products/${pluPanel.id}/plu`); setPluPanel(null); }}
                  className="text-xs text-[#1B4F8A] hover:underline">Full Manager →</button>
                <button onClick={() => setPluPanel(null)} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {pluPanelLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
              ) : (
                <>
                  {/* Add PLU inline form */}
                  {showPluPanelAdd && (
                    <div className="border-2 border-green-300 bg-green-50/40 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-green-800 mb-2">New PLU for {pluPanel.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-medium text-gray-500 block mb-1">MRP (₹) *</label>
                          <input autoFocus type="number" value={pluPanelAddForm.mrp} onChange={e => setPluPanelAddForm(f => ({ ...f, mrp: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]" placeholder="0.00" />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-gray-500 block mb-1">Selling Price (₹) *</label>
                          <input type="number" value={pluPanelAddForm.sellingPrice} onChange={e => setPluPanelAddForm(f => ({ ...f, sellingPrice: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]" placeholder="0.00" />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-gray-500 block mb-1">GST Rate %</label>
                          <select value={pluPanelAddForm.gstRate} onChange={e => setPluPanelAddForm(f => ({ ...f, gstRate: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]">
                            <option value="">— select —</option>
                            {pluPanelTaxRates.map(t => <option key={t.id} value={String(t.taxRate)}>{t.taxRate}% — {t.taxName}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-gray-500 block mb-1">Pack Label</label>
                          <input value={pluPanelAddForm.packLabel} onChange={e => setPluPanelAddForm(f => ({ ...f, packLabel: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]" placeholder="e.g. 500g, 1L" />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={savePluPanelAdd} disabled={pluPanelAddSaving}
                          className="flex-1 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg font-semibold transition-colors">
                          {pluPanelAddSaving ? 'Creating…' : 'Create PLU'}
                        </button>
                        <button onClick={() => setShowPluPanelAdd(false)}
                          className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Existing PLU cards */}
                  {pluPanelData.filter((pl: any) => !pl.isArchived).length === 0 && !showPluPanelAdd && (
                    <div className="text-center py-10 text-gray-400 text-sm">
                      <p className="mb-3">No PLUs yet</p>
                      <button onClick={() => { setShowPluPanelAdd(true); setPluPanelAddForm({ mrp: '', sellingPrice: '', gstRate: '', cessRate: '0', packLabel: '' }); }}
                        className="text-green-600 hover:underline text-sm font-medium">+ Create first PLU</button>
                    </div>
                  )}

                  {pluPanelData.filter((pl: any) => !pl.isArchived).map((pl: any) => {
                    const isEditing = pluPanelEditId === pl.id;
                    return (
                      <div key={pl.id} className={`border rounded-xl ${isEditing ? 'border-blue-300 bg-blue-50/30' : pl.isDefault ? 'border-blue-200 bg-blue-50/20' : 'border-gray-200'}`}>
                        {/* PLU card header */}
                        <div className="flex items-center justify-between px-3 pt-3 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-gray-700">{pl.pluCode}</span>
                            {pl.isDefault && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Default</span>}
                            {pl.displayName && <span className="text-xs text-gray-500">{pl.displayName}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Stock: <strong className="text-gray-700">{Number(pl.stockOnHand ?? 0).toFixed(2)}</strong></span>
                            <button
                              onClick={() => isEditing ? setPluPanelEditId(null) : openPluPanelEdit(pl)}
                              className={`text-xs px-2 py-0.5 rounded-lg border transition-colors ${isEditing ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-[#1B4F8A] hover:bg-blue-50'}`}
                            >{isEditing ? '✕ Cancel' : '✎ Edit'}</button>
                          </div>
                        </div>

                        {/* Read-only values */}
                        {!isEditing && (
                          <div className="grid grid-cols-3 gap-2 px-3 pb-3 text-sm">
                            <div><span className="text-xs text-gray-400 block">MRP</span><span className="font-semibold">₹{Number(pl.mrp).toFixed(2)}</span></div>
                            <div><span className="text-xs text-gray-400 block">Sale Price</span><span className="font-semibold text-[#1B4F8A]">₹{Number(pl.sellingPrice).toFixed(2)}</span></div>
                            <div><span className="text-xs text-gray-400 block">GST</span><span className="font-semibold">{pl.gstRate}%</span></div>
                            {pl.wholesalePrice && <div><span className="text-xs text-gray-400 block">Wholesale</span><span className="font-medium">₹{Number(pl.wholesalePrice).toFixed(2)}</span></div>}
                            {pl.eanCode && <div className="col-span-2"><span className="text-xs text-gray-400 block">EAN</span><span className="font-mono text-xs">{pl.eanCode}</span></div>}
                          </div>
                        )}

                        {/* Inline edit form */}
                        {isEditing && (
                          <div className="px-3 pb-3 space-y-2 border-t border-blue-100 pt-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[11px] font-medium text-gray-500 block mb-1">MRP (₹) *</label>
                                <input autoFocus type="number" value={pluPanelEditForm.mrp}
                                  onChange={e => setPluPanelEditForm(f => ({ ...f, mrp: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#1B4F8A]" />
                              </div>
                              <div>
                                <label className="text-[11px] font-medium text-gray-500 block mb-1">Selling Price (₹) *</label>
                                <input type="number" value={pluPanelEditForm.sellingPrice}
                                  onChange={e => setPluPanelEditForm(f => ({ ...f, sellingPrice: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#1B4F8A]" />
                              </div>
                              <div>
                                <label className="text-[11px] font-medium text-gray-500 block mb-1">Wholesale Price (₹)</label>
                                <input type="number" value={pluPanelEditForm.wholesalePrice}
                                  onChange={e => setPluPanelEditForm(f => ({ ...f, wholesalePrice: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#1B4F8A]" />
                              </div>
                              <div>
                                <label className="text-[11px] font-medium text-gray-500 block mb-1">Min Selling (₹)</label>
                                <input type="number" value={pluPanelEditForm.minSellingPrice}
                                  onChange={e => setPluPanelEditForm(f => ({ ...f, minSellingPrice: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#1B4F8A]" />
                              </div>
                              <div>
                                <label className="text-[11px] font-medium text-gray-500 block mb-1">GST Rate %</label>
                                <select value={pluPanelEditForm.gstRate}
                                  onChange={e => setPluPanelEditForm(f => ({ ...f, gstRate: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#1B4F8A]">
                                  <option value="">— select —</option>
                                  {pluPanelTaxRates.map(t => <option key={t.id} value={String(t.taxRate)}>{t.taxRate}% — {t.taxName}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-[11px] font-medium text-gray-500 block mb-1">Pack Label</label>
                                <input value={pluPanelEditForm.packLabel}
                                  onChange={e => setPluPanelEditForm(f => ({ ...f, packLabel: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#1B4F8A]" placeholder="e.g. 500g" />
                              </div>
                              <div>
                                <label className="text-[11px] font-medium text-gray-500 block mb-1">CESS %</label>
                                <input type="number" value={pluPanelEditForm.cessRate}
                                  onChange={e => setPluPanelEditForm(f => ({ ...f, cessRate: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#1B4F8A]" />
                              </div>
                            </div>
                            <div className="flex items-center gap-4 py-1">
                              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                <button type="button" onClick={() => setPluPanelEditForm(f => ({ ...f, taxInclusive: !f.taxInclusive }))}
                                  className={`w-8 h-4 rounded-full relative transition-colors ${pluPanelEditForm.taxInclusive ? 'bg-[#1B4F8A]' : 'bg-gray-300'}`}>
                                  <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${pluPanelEditForm.taxInclusive ? 'translate-x-4' : ''}`} />
                                </button>
                                <span className="text-xs text-gray-600">Tax Inclusive</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                <button type="button" onClick={() => setPluPanelEditForm(f => ({ ...f, availableOnline: !f.availableOnline }))}
                                  className={`w-8 h-4 rounded-full relative transition-colors ${pluPanelEditForm.availableOnline ? 'bg-green-500' : 'bg-gray-300'}`}>
                                  <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${pluPanelEditForm.availableOnline ? 'translate-x-4' : ''}`} />
                                </button>
                                <span className="text-xs text-gray-600">Online</span>
                              </label>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => savePluPanelEdit(pl.id)} disabled={pluPanelSaving}
                                className="flex-1 py-2 text-sm bg-[#1B4F8A] hover:bg-[#163f6e] disabled:opacity-60 text-white rounded-lg font-semibold transition-colors">
                                {pluPanelSaving ? 'Saving…' : 'Save Changes'}
                              </button>
                              <button onClick={() => setPluPanelEditId(null)}
                                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <button onClick={() => { router.push(`/dashboard/products/${pluPanel.id}/plu`); setPluPanel(null); }}
                className="w-full py-2 text-sm border border-[#1B4F8A] text-[#1B4F8A] rounded-xl hover:bg-blue-50 font-medium transition-colors">
                Open Full PLU Manager (Bundles, Barcodes, History)
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .inp { width:100%; padding:0.5rem 0.75rem; font-size:0.875rem; border:1px solid #e5e7eb; border-radius:0.5rem; outline:none; background:white; transition:border-color 0.15s; }
        .inp:focus { border-color:#1B4F8A; }
        .inp:disabled { background:#f9fafb; color:#9ca3af; cursor:not-allowed; }
        .inp.border-red-400 { border-color:#f87171; }
        .inp.border-amber-400 { border-color:#fbbf24; }
      `}</style>
    </>
  );
}

function Fld({ label, children, help }: { label: string; children: React.ReactNode; help?: FieldHelpProps }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-0.5">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        {help && <FieldHelp title={help.title} description={help.description} example={help.example} />}
      </div>
      {children}
      {help?.hint && <FieldHelp hint={help.hint} />}
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="col-span-2 lg:col-span-4 flex items-center gap-3 pt-2">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}
