'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Warehouse, Search, Save, RefreshCw, ChevronDown,
  AlertCircle, CheckCircle, Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { BarcodeScannerInput } from '@/components/shared/BarcodeScannerInput';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string }

interface ProductRow {
  id: string;
  productCode: string;
  name: string;
  barcode: string | null;
  unitOfMeasure: string;
  currentStock: number;
  reorderLevel: number | null;
  category: { name: string; label: string } | null;
  qty: string; // editable field
  dirty: boolean;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OpeningStockPage() {
  const [branches, setBranches]     = useState<Branch[]>([]);
  const [branchId, setBranchId]     = useState('');
  const [rows, setRows]             = useState<ProductRow[]>([]);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState('');
  const [saved, setSaved]           = useState(false);
  const firstQtyRef = useRef<HTMLInputElement>(null);

  // Load branches
  useEffect(() => {
    api.get('/branches').then(r => {
      const list: Branch[] = r.data;
      setBranches(list);
      if (list.length > 0) setBranchId(list[0].id);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setSaved(false);
    try {
      const r = await api.get('/inventory/opening-stock', { params: { branchId } });
      const products = r.data.products ?? [];
      setRows(
        products.map((p: any) => ({
          id: p.id,
          productCode: p.productCode ?? '',
          name: p.name,
          barcode: p.barcode ?? null,
          unitOfMeasure: p.unitOfMeasure ?? 'PCS',
          currentStock: p.currentStock ?? 0,
          reorderLevel: p.reorderLevel ?? null,
          category: p.category ?? null,
          qty: '',
          dirty: false,
        })),
      );
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  const setQty = (id: string, val: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, qty: val, dirty: true } : r));
  };

  const handleSave = async () => {
    const dirtyRows = rows.filter(r => r.dirty && r.qty.trim() !== '');
    if (dirtyRows.length === 0) {
      toast('No quantities entered.', { icon: '⚠️' });
      return;
    }

    const items = dirtyRows.map(r => ({
      productId: r.id,
      quantity: Number(r.qty) || 0,
    })).filter(i => i.quantity > 0);

    if (items.length === 0) {
      toast('All quantities are zero — nothing to save.', { icon: '⚠️' });
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/inventory/stock-take', {
        branchId,
        sessionName: `Opening Stock — ${new Date().toLocaleDateString('en-IN')}`,
        items,
      });
      toast.success(`Saved ${res.data.created} product(s)`);
      setSaved(true);
      // Reload to show updated stock
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const filtered = rows.filter(r =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.barcode?.includes(search) ?? false) ||
    r.productCode.includes(search) ||
    (r.category?.name.toLowerCase().includes(search.toLowerCase()) ?? false),
  );

  const dirtyCount = rows.filter(r => r.dirty && r.qty.trim() !== '' && Number(r.qty) > 0).length;

  return (
    <div className="p-6 max-w-full">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Inventory' },
        { label: 'Opening Stock' },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1B4F8A] rounded-xl flex items-center justify-center">
            <Warehouse className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Opening Stock</h1>
            <p className="text-xs text-gray-500">Set initial stock quantities for all products</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Branch selector */}
          {branches.length > 1 && (
            <div className="relative">
              <select
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A] bg-white"
              >
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}

          <button
            onClick={load}
            disabled={loading}
            className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleSave}
            disabled={saving || dirtyCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-medium hover:bg-[#163d6e] disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : `Save ${dirtyCount > 0 ? `(${dirtyCount})` : ''}`}
          </button>
        </div>
      </div>

      {/* Info banner */}
      {saved && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Opening stock saved. Current stock column updated below.
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <AlertCircle className="w-4 h-4 shrink-0" />
        Enter quantities only for products that have stock. Leave blank to skip. Each save adds to existing stock.
      </div>

      {/* Search */}
      <BarcodeScannerInput
        placeholder="Search by name, barcode, code or scan…"
        value={search} onChange={setSearch}
        className="mb-4"
        inputClassName="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]"
      />

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Loading products…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Package className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">No products found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Barcode</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-20">UOM</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 w-28">Current Stock</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 w-36">Opening Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-gray-50 transition-colors ${row.dirty && row.qty ? 'bg-blue-50/40' : ''}`}
                  >
                    <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{row.productCode}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900">{row.name}</div>
                      {row.category && (
                        <div className="text-xs text-gray-400">{row.category.label}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{row.barcode ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{row.unitOfMeasure}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-medium ${row.currentStock <= 0 ? 'text-red-500' : row.reorderLevel && row.currentStock <= row.reorderLevel ? 'text-amber-600' : 'text-gray-800'}`}>
                        {row.currentStock}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        ref={idx === 0 ? firstQtyRef : undefined}
                        type="number"
                        min="0"
                        step="1"
                        value={row.qty}
                        onChange={e => setQty(row.id, e.target.value)}
                        placeholder="0"
                        className="w-full text-right border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A] focus:border-transparent"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && filtered.length > 0 && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-400 px-1">
          <span>{filtered.length} product{filtered.length !== 1 ? 's' : ''} shown</span>
          {dirtyCount > 0 && (
            <span className="text-blue-600 font-medium">{dirtyCount} product{dirtyCount !== 1 ? 's' : ''} with quantity entered</span>
          )}
        </div>
      )}
    </div>
  );
}
