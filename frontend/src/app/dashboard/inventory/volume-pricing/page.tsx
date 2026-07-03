'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Trash2, Layers, X, Check } from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface VolumeTier {
  id: string;
  minQty: number;
  price: number;
}

interface PluWithTiers {
  pluBarcode:   string;
  productName:  string;
  displayName:  string | null;
  sellingPrice: number | null;
  mrp:          number | null;
  unitOfMeasure: string | null;
  tiers:        VolumeTier[];
}

const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

// ─── Add-tier modal ───────────────────────────────────────────────────────────

function AddTierModal({
  plu,
  onClose,
}: {
  plu: PluWithTiers;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [minQty, setMinQty] = useState('');
  const [price,  setPrice]  = useState('');

  const add = useMutation({
    mutationFn: () => api.post('/volume-pricing', { pluBarcode: plu.pluBarcode, minQty: Number(minQty), price: Number(price) }),
    onSuccess: () => {
      toast.success('Tier saved');
      qc.invalidateQueries({ queryKey: ['volume-pricing'] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to save'),
  });

  const canSave = Number(minQty) >= 1 && Number(price) > 0;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Add Volume Tier</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <p className="text-sm text-gray-500">{plu.productName}{plu.displayName ? ` · ${plu.displayName}` : ''}</p>
        {plu.sellingPrice && (
          <p className="text-xs text-gray-400">Base price: Rs.{inr(plu.sellingPrice)} / {plu.unitOfMeasure ?? 'unit'}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Min Qty ({plu.unitOfMeasure ?? 'units'})</label>
            <input
              type="number" min={1} value={minQty} onChange={e => setMinQty(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
              placeholder="e.g. 6"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Price (Rs.)</label>
            <input
              type="number" min={0} step={0.01} value={price} onChange={e => setPrice(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
              placeholder="e.g. 45.00"
            />
          </div>
        </div>
        {plu.sellingPrice && Number(price) > 0 && Number(price) < plu.sellingPrice && (
          <p className="text-xs text-green-600">
            Discount: Rs.{inr(plu.sellingPrice - Number(price))} off base price
          </p>
        )}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => canSave && add.mutate()}
            disabled={!canSave || add.isPending}
            className="flex-1 py-2 text-sm bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163f6e] disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <Check className="w-4 h-4" /> Save Tier
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New PLU bar ──────────────────────────────────────────────────────────────

function AddPluBar() {
  const qc = useQueryClient();
  const [barcode, setBarcode] = useState('');
  const [minQty,  setMinQty]  = useState('');
  const [price,   setPrice]   = useState('');

  const add = useMutation({
    mutationFn: () => api.post('/volume-pricing', {
      pluBarcode: barcode.trim(), minQty: Number(minQty), price: Number(price),
    }),
    onSuccess: () => {
      toast.success('Tier added');
      qc.invalidateQueries({ queryKey: ['volume-pricing'] });
      setBarcode(''); setMinQty(''); setPrice('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to add'),
  });

  const canSave = barcode.trim() && Number(minQty) >= 1 && Number(price) > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Add tier for a new PLU</p>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">PLU Barcode</label>
          <input
            value={barcode} onChange={e => setBarcode(e.target.value)}
            className="w-40 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] font-mono"
            placeholder="Scan or type"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Min Qty</label>
          <input
            type="number" min={1} value={minQty} onChange={e => setMinQty(e.target.value)}
            className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
            placeholder="6"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Price (Rs.)</label>
          <input
            type="number" min={0} step={0.01} value={price} onChange={e => setPrice(e.target.value)}
            className="w-28 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
            placeholder="45.00"
          />
        </div>
        <button
          onClick={() => canSave && add.mutate()}
          disabled={!canSave || add.isPending}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163f6e] disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add Tier
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VolumePricingPage() {
  const qc = useQueryClient();
  const [activePlu, setActivePlu] = useState<PluWithTiers | null>(null);
  const [search, setSearch]       = useState('');

  const { data = [], isLoading } = useQuery<PluWithTiers[]>({
    queryKey: ['volume-pricing'],
    queryFn:  () => api.get('/volume-pricing/all').then(r => r.data),
    staleTime: 30_000,
  });

  const deleteTier = useMutation({
    mutationFn: (id: string) => api.delete(`/volume-pricing/${id}`),
    onSuccess: () => {
      toast.success('Tier removed');
      qc.invalidateQueries({ queryKey: ['volume-pricing'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to remove'),
  });

  const filtered = search.trim()
    ? data.filter(p =>
        p.productName.toLowerCase().includes(search.toLowerCase()) ||
        p.pluBarcode.toLowerCase().includes(search.toLowerCase()),
      )
    : data;

  return (
    <>
      <Header title="Volume Pricing" />

      <main className="flex-1 p-6 space-y-5">
        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          <strong>Volume pricing</strong> sets lower per-unit prices when a customer buys in bulk.
          The highest matching tier applies automatically at POS and online store.
        </div>

        {/* Add new */}
        <AddPluBar />

        {/* Search + count */}
        <div className="flex items-center gap-3">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search product or barcode…"
            className="flex-1 max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
          />
          <span className="text-sm text-gray-400 ml-auto">
            {filtered.length} PLU{filtered.length !== 1 ? 's' : ''} with tiers
          </span>
        </div>

        {/* PLU cards */}
        {isLoading ? (
          <div className="text-center text-gray-400 text-sm py-8">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
            {data.length === 0
              ? 'No volume pricing tiers set up yet'
              : 'No PLUs match your search'}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(plu => (
              <div key={plu.pluBarcode} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                {/* PLU header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-800 text-sm leading-tight">{plu.productName}</p>
                      {plu.displayName && <p className="text-xs text-gray-400 mt-0.5">{plu.displayName}</p>}
                    </div>
                    <button
                      onClick={() => setActivePlu(plu)}
                      className="flex items-center gap-1 text-xs text-[#1B4F8A] hover:underline shrink-0"
                    >
                      <Plus className="w-3 h-3" /> Add tier
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <span className="text-xs font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                      {plu.pluBarcode}
                    </span>
                    {plu.sellingPrice !== null && (
                      <span className="text-xs text-gray-500">Base: Rs.{inr(plu.sellingPrice)}</span>
                    )}
                  </div>
                </div>

                {/* Tiers table */}
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">Min Qty</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-500">Price</th>
                        {plu.sellingPrice !== null && (
                          <th className="text-right px-3 py-2 font-medium text-gray-500">Discount</th>
                        )}
                        <th className="w-8 px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {plu.tiers.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-700">
                            ≥ {t.minQty} {plu.unitOfMeasure ?? ''}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-800">
                            Rs.{inr(t.price)}
                          </td>
                          {plu.sellingPrice !== null && (
                            <td className="px-3 py-2 text-right text-green-600">
                              {plu.sellingPrice > t.price
                                ? `-Rs.${inr(plu.sellingPrice - t.price)}`
                                : '—'}
                            </td>
                          )}
                          <td className="px-2 py-2">
                            <button
                              onClick={() => {
                                if (!confirm('Remove this tier?')) return;
                                deleteTier.mutate(t.id);
                              }}
                              className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {activePlu && <AddTierModal plu={activePlu} onClose={() => setActivePlu(null)} />}
    </>
  );
}
