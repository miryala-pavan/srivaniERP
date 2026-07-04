'use client';

import { useEffect, useState } from 'react';
import { Package, Tag, Barcode, Hash, Layers } from 'lucide-react';
import api from '@/lib/api';
import { usePopup } from '@/context/PopupContext';
import { inr } from '@/lib/report-format';

interface Plu {
  id: string; packLabel: string; packSize: number; unitOfMeasure: string;
  costPrice: number | null; mrp: number; sellingPrice: number;
  gstRate: number | null; hsnCode: string | null;
  isDefault: boolean; isActive: boolean;
}
interface ProductDetail {
  id: string; name: string; shortName?: string | null;
  productCode?: string | null; barcode?: string | null; hsnCode?: string | null;
  unitOfMeasure: string; mrp: number; sellingPrice: number;
  isActive: boolean;
  category?: { name: string } | null;
  brand?: { name: string } | null;
  tax?: { taxRate: number; taxName: string } | null;
  plus: Plu[];
  currentStock?: number;
}

export default function ProductPanel({ id }: { id: string }) {
  const { push } = usePopup();
  const [data, setData] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    api.get<ProductDetail>(`/products/${id}`)
      .then(r => { if (!cancelled) setData(r.data); })
      .catch(() => { if (!cancelled) setError('Failed to load product'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <PanelSkeleton />;
  if (error || !data) return <PanelError msg={error || 'Not found'} />;

  const activePlus = data.plus.filter(p => p.isActive);

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Package className="w-5 h-5 text-[#1B4F8A]" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900 leading-snug">{data.name}</h2>
          {data.shortName && <p className="text-sm text-gray-400">{data.shortName}</p>}
          <div className="flex flex-wrap gap-2 mt-1.5">
            {data.category?.name && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{data.category.name}</span>
            )}
            {data.brand?.name && (
              <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{data.brand.name}</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${data.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {data.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Identity */}
      <Section title="Identity">
        <Row icon={<Hash />}     label="Product Code"  value={data.productCode ?? '—'} />
        <Row icon={<Barcode />}  label="Barcode"       value={data.barcode ?? '—'} />
        <Row icon={<Tag />}      label="HSN Code"      value={data.hsnCode ?? '—'} />
        <Row icon={<Layers />}   label="GST Rate"      value={data.tax ? `${data.tax.taxRate}% (${data.tax.taxName})` : '—'} />
      </Section>

      {/* Base prices */}
      <Section title="Base Prices">
        <div className="grid grid-cols-2 gap-3">
          <PriceCard label="MRP"           value={data.mrp}          color="text-gray-800" />
          <PriceCard label="Selling Price" value={data.sellingPrice} color="text-green-700" />
        </div>
      </Section>

      {/* Stock */}
      {data.currentStock !== undefined && (
        <Section title="Current Stock">
          <div className={`text-2xl font-bold ${(data.currentStock ?? 0) <= 0 ? 'text-red-600' : 'text-gray-800'}`}>
            {data.currentStock} {data.unitOfMeasure}
          </div>
        </Section>
      )}

      {/* Active PLUs */}
      {activePlus.length > 0 && (
        <Section title={`PLUs (${activePlus.length} active)`}>
          <div className="space-y-2">
            {activePlus.map(plu => (
              <div key={plu.id} className={`rounded-lg border p-3 text-sm ${plu.isDefault ? 'border-[#1B4F8A] bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">{plu.packLabel}</span>
                  {plu.isDefault && <span className="text-[10px] text-[#1B4F8A] font-semibold bg-blue-100 px-1.5 py-0.5 rounded-full">DEFAULT</span>}
                </div>
                <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
                  <span>MRP <span className="font-medium text-gray-700">₹{inr(plu.mrp)}</span></span>
                  <span>SP <span className="font-medium text-green-700">₹{inr(plu.sellingPrice)}</span></span>
                  {plu.costPrice != null && (
                    <span>Cost <span className="font-medium text-gray-700">₹{inr(plu.costPrice)}</span></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-300 w-3.5 h-3.5 flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>
      <span className="text-xs text-gray-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value}</span>
    </div>
  );
}

function PriceCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-lg font-bold ${color}`}>₹{inr(Number(value))}</p>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="p-5 space-y-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 bg-gray-100 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-100 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}
    </div>
  );
}

function PanelError({ msg }: { msg: string }) {
  return <div className="p-8 text-center text-sm text-red-500">{msg}</div>;
}
