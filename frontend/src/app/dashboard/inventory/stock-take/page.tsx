'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Trash2, RefreshCw, Download,
  Upload, AlertCircle, CheckCircle, Package, ChevronDown, Camera, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import Header from '@/components/layout/Header';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string }

interface StockLevel {
  productId: string;
  branchId: string;
  currentStock: number;
  product?: {
    id: string; name: string; barcode?: string; unitOfMeasure?: string;
    reorderLevel?: number; isActive?: boolean; isManuallyDisabled?: boolean;
  };
  branch?: { id: string; name: string };
}

interface ManualEntry {
  productId: string; productName: string; barcode: string; quantity: number;
  isActive: boolean; isManuallyDisabled: boolean;
}

type Tab = 'manual' | 'import';

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StockTakePage() {
  const queryClient = useQueryClient();
  const { connected } = useWebSocket();

  const [tab, setTab]                 = useState<Tab>('manual');
  const [branches, setBranches]       = useState<Branch[]>([]);
  const [branchId, setBranchId]       = useState('');
  const [sessionName, setSessionName] = useState('');

  // Manual tab state
  const [searchQuery, setSearchQuery]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [entries, setEntries]                 = useState<ManualEntry[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeScanner = useBarcodeScanner((code) => { setSearchQuery(code); setDebouncedSearch(code); });

  // Import tab state
  const [importFile, setImportFile]       = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ productId: string; productName: string; quantity: number; error?: string }[]>([]);
  const [importResult, setImportResult]   = useState<{ created: number; errors: any[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/business/info').then(r => {
      const list: Branch[] = r.data?.branches ?? [];
      setBranches(list);
      if (list.length === 1) setBranchId(list[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useWebSocketEvent('inventory.stock-adjusted', () => {
    queryClient.invalidateQueries({ queryKey: ['stock-take'] });
  });

  // ─── Queries ──────────────────────────────────────────────────────────────

  const { data: stockLevels = [], isLoading: levelsLoading } = useQuery<StockLevel[]>({
    queryKey: ['stock-take', 'levels', branchId],
    queryFn: async () => {
      const res = await api.get('/inventory/stock-levels', { params: { branchId } });
      return res.data ?? [];
    },
    enabled: !!branchId,
    staleTime: 30_000,
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<any[]>({
    queryKey: ['stock-take', 'search', debouncedSearch],
    queryFn: async () => {
      const res = await api.get('/products', {
        params: { search: debouncedSearch, includeInactive: 'true', limit: '10' },
      });
      return res.data?.data ?? [];
    },
    enabled: debouncedSearch.trim().length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  // ─── Mutations ────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (payload: { branchId: string; sessionName: string; items: { productId: string; quantity: number }[] }) =>
      api.post('/inventory/stock-take', payload).then(r => r.data),
    onSuccess: (data) => {
      toast.success(`Saved ${data.created} product(s) stock entries`);
      if (data.errors.length > 0) toast.error(`${data.errors.length} item(s) had errors`);
      setEntries([]);
      queryClient.invalidateQueries({ queryKey: ['stock-take'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to save stock entries');
    },
  });

  const importMutation = useMutation({
    mutationFn: (payload: { branchId: string; sessionName: string; items: { productId: string; quantity: number }[] }) =>
      api.post('/inventory/stock-take', payload).then(r => r.data),
    onSuccess: (data) => {
      setImportResult(data);
      toast.success(`Imported ${data.created} entries`);
      setImportFile(null);
      setImportPreview([]);
      if (fileRef.current) fileRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['stock-take'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Import failed');
    },
  });

  const saving    = saveMutation.isPending;
  const importing = importMutation.isPending;

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function addProduct(product: any) {
    setSearchQuery('');
    setDebouncedSearch('');
    if (entries.some(e => e.productId === product.id)) {
      toast('Product already added — adjust the quantity below');
      return;
    }
    setEntries(prev => [...prev, {
      productId:          product.id,
      productName:        product.name,
      barcode:            product.barcode ?? '',
      quantity:           0,
      isActive:           product.isActive ?? true,
      isManuallyDisabled: product.isManuallyDisabled ?? false,
    }]);
    setTimeout(() => searchRef.current?.focus(), 100);
  }

  function updateQty(productId: string, qty: number) {
    setEntries(prev => prev.map(e => e.productId === productId ? { ...e, quantity: Math.max(0, qty) } : e));
  }

  function removeEntry(productId: string) {
    setEntries(prev => prev.filter(e => e.productId !== productId));
  }

  function saveManual() {
    if (!branchId) { toast.error('Select a branch first'); return; }
    if (entries.length === 0) { toast.error('Add at least one product'); return; }
    saveMutation.mutate({
      branchId,
      sessionName: sessionName.trim() || `Stock Take ${new Date().toLocaleDateString('en-IN')}`,
      items: entries.map(e => ({ productId: e.productId, quantity: e.quantity })),
    });
  }

  // ─── CSV template download ────────────────────────────────────────────────

  async function downloadTemplate() {
    try {
      const res = await api.get('/inventory/stock-take/template', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'stock-take-template.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download template');
    }
  }

  // ─── CSV import ───────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) { toast.error('CSV is empty'); return; }

    const rows = lines.slice(1).map(line => {
      const cols        = line.split(',');
      const productId   = cols[0]?.trim();
      const productName = cols[1]?.replace(/^"|"$/g, '').trim();
      const qty         = parseFloat(cols[4]?.trim() ?? '0');
      const error       = !productId ? 'Missing productId' : isNaN(qty) ? 'Invalid quantity' : undefined;
      return { productId, productName: productName ?? '', quantity: isNaN(qty) ? 0 : qty, error };
    }).filter(r => r.productId);

    setImportPreview(rows);
  }

  function submitImport() {
    if (!branchId) { toast.error('Select a branch first'); return; }
    if (importPreview.length === 0) { toast.error('No valid rows to import'); return; }
    const validRows = importPreview.filter(r => !r.error);
    importMutation.mutate({
      branchId,
      sessionName: sessionName.trim() || `CSV Import ${new Date().toLocaleDateString('en-IN')}`,
      items: validRows.map(r => ({ productId: r.productId, quantity: r.quantity })),
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const visibleSearchResults = searchQuery.trim() ? searchResults : [];

  return (
    <>
      <Header
        title="Opening Stock / Stock Take"
        actions={
          <span className={`text-xs font-medium ${connected ? 'text-green-600' : 'text-gray-400'}`}>
            {connected ? '● Live' : '○ Offline'}
          </span>
        }
      />
      <main className="flex-1 p-6 max-w-5xl mx-auto">

        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory' },
          { label: 'Stock-take' },
        ]} />

        {/* Branch + Session */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch <span className="text-red-500">*</span></label>
              {branches.length === 1 ? (
                <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
                  {branches[0].name}
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={branchId}
                    onChange={e => setBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none pr-8"
                  >
                    <option value="">Select branch...</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Session Name <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                placeholder={`Opening Stock ${new Date().toLocaleDateString('en-IN')}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
          <button
            onClick={() => setTab('manual')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'manual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Manual Entry
          </button>
          <button
            onClick={() => setTab('import')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'import' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            CSV Import
          </button>
        </div>

        {/* ── MANUAL TAB ── */}
        {tab === 'manual' && (
          <div className="space-y-4">
            {/* Product search */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Add Product</label>
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const q = searchQuery.trim();
                      if (!q) return;
                      if (visibleSearchResults.length > 0) {
                        const exact = visibleSearchResults.find((p: any) => p.barcode === q || p.productCode === q || p.ean === q);
                        const target = exact ?? (visibleSearchResults.length === 1 ? visibleSearchResults[0] : null);
                        if (target) addProduct(target);
                        return;
                      }
                      try {
                        const res = await api.get('/products', { params: { search: q, includeInactive: true, limit: 10 } });
                        const results = res.data?.data ?? [];
                        const exact = results.find((p: any) => p.barcode === q || p.productCode === q || p.ean === q);
                        const target = exact ?? (results.length === 1 ? results[0] : null);
                        if (target) addProduct(target);
                      } catch {}
                    }}
                    placeholder="Search by name or barcode or scan…"
                    className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  {searchLoading
                    ? <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                    : (
                      <button
                        type="button"
                        onClick={barcodeScanner.cameraSupported ? (barcodeScanner.showCamera ? barcodeScanner.stopCamera : barcodeScanner.startCamera) : undefined}
                        title={barcodeScanner.showCamera ? 'Stop camera' : 'Scan barcode with camera'}
                        className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors ${
                          !barcodeScanner.cameraSupported ? 'text-gray-300 cursor-default'
                          : barcodeScanner.showCamera ? 'text-red-500 hover:text-red-700'
                          : 'text-blue-600 hover:text-blue-800'
                        }`}
                      >
                        {barcodeScanner.showCamera ? <X className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                      </button>
                    )
                  }
                </div>
                {barcodeScanner.showCamera && (
                  <div className="mt-1.5 rounded-xl overflow-hidden border border-gray-200 bg-black relative" style={{ height: 140 }}>
                    <video ref={barcodeScanner.videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-green-400 opacity-80 animate-pulse" />
                    <p className="absolute bottom-1 left-0 right-0 text-center text-white text-[10px] opacity-70">Point at barcode · Scanning automatically</p>
                  </div>
                )}
                {barcodeScanner.cameraError && <p className="text-xs text-red-500 mt-1">{barcodeScanner.cameraError}</p>}
              </div>

              {visibleSearchResults.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {visibleSearchResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addProduct(p)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 text-left border-b border-gray-100 last:border-0 transition-colors"
                    >
                      <Package className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm truncate">{p.name}</span>
                          {(!p.isActive || p.isManuallyDisabled) && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">Disabled</span>
                          )}
                        </div>
                        {p.barcode && <div className="text-xs text-gray-400 font-mono">{p.barcode}</div>}
                      </div>
                      <Plus className="w-4 h-4 text-blue-500 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Entry list */}
            {entries.length > 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{entries.length} product(s) added</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Barcode</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Current Stock</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Count Qty</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {entries.map(entry => {
                      const level    = stockLevels.find(s => s.productId === entry.productId && s.branchId === branchId);
                      const disabled = !entry.isActive || entry.isManuallyDisabled;
                      return (
                        <tr key={entry.productId} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{entry.productName}</span>
                              {disabled && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">Disabled</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{entry.barcode || '—'}</td>
                          <td className="px-4 py-3 text-gray-500">
                            {levelsLoading ? '...' : level ? level.currentStock : '0'}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={entry.quantity}
                              onChange={e => updateQty(entry.productId, parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => removeEntry(entry.productId)} className="text-gray-400 hover:text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-5 py-4 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={saveManual}
                    disabled={saving || !branchId}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                    Save Stock Entries
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200 border-dashed">
                <Package className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                <div className="text-gray-400 text-sm">Search and add products to count their stock</div>
              </div>
            )}
          </div>
        )}

        {/* ── IMPORT TAB ── */}
        {tab === 'import' && (
          <div className="space-y-4">
            {/* Download template */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 text-sm">Step 1: Download Template</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    CSV with all products (active and inactive) — fill in the quantity column
                  </div>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
              </div>
            </div>

            {/* Upload */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="font-medium text-gray-900 text-sm mb-3">Step 2: Upload Filled CSV</div>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <Upload className="w-6 h-6 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">
                  {importFile ? importFile.name : 'Click to upload or drag & drop CSV'}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Preview */}
            {importPreview.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {importPreview.length} rows previewed
                    {importPreview.filter(r => r.error).length > 0 && (
                      <span className="ml-2 text-red-500">
                        ({importPreview.filter(r => r.error).length} errors)
                      </span>
                    )}
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                        <th className="text-left px-4 py-2 font-semibold text-gray-500">Product Name</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-500">Qty</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {importPreview.map((row, i) => (
                        <tr key={i} className={row.error ? 'bg-red-50' : ''}>
                          <td className="px-4 py-2 text-gray-800">{row.productName}</td>
                          <td className="px-4 py-2 font-mono">{row.quantity}</td>
                          <td className="px-4 py-2">
                            {row.error
                              ? <span className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="w-3 h-3" />{row.error}</span>
                              : <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3 h-3" />OK</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-4 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={submitImport}
                    disabled={importing || !branchId}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {importing && <RefreshCw className="w-4 h-4 animate-spin" />}
                    Import {importPreview.filter(r => !r.error).length} Valid Rows
                  </button>
                </div>
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-green-800">Import Successful</div>
                  <div className="text-sm text-green-700 mt-0.5">
                    {importResult.created} stock entries created.
                    {importResult.errors.length > 0 && ` ${importResult.errors.length} rows had errors.`}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CURRENT STOCK LEVELS ── */}
        {branchId && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Current Stock Levels</h2>
            {levelsLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
              </div>
            ) : stockLevels.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <Package className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                <div className="text-gray-400 text-sm">No stock recorded for this branch yet</div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                        <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Barcode</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">UOM</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Reorder</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {stockLevels.map((row, i) => {
                        const isDisabled = row.product && (!row.product.isActive || row.product.isManuallyDisabled);
                        return (
                          <tr key={i} className={`hover:bg-gray-50 ${row.currentStock <= 0 ? 'text-red-600' : row.currentStock <= (row.product?.reorderLevel ?? 0) ? 'text-amber-600' : ''}`}>
                            <td className="px-4 py-2.5 font-medium">
                              <div className="flex items-center gap-2">
                                <span>{row.product?.name ?? row.productId}</span>
                                {isDisabled && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">Disabled</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{row.product?.barcode ?? '—'}</td>
                            <td className="px-4 py-2.5 text-gray-500">{row.product?.unitOfMeasure ?? '—'}</td>
                            <td className="px-4 py-2.5 text-right font-semibold">{row.currentStock}</td>
                            <td className="px-4 py-2.5 text-right text-gray-400">{row.product?.reorderLevel ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
