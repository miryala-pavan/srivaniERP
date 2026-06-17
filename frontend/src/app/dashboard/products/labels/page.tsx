'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Printer, X, Plus, Minus, ChevronDown } from 'lucide-react';
import { BackButton } from '@/components/shared/BackButton';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Business {
  name: string; address?: string | null; phone?: string | null;
  fssaiLicense?: string | null; gstin?: string | null;
}

interface LabelProduct {
  id: string; name: string; productCode: string | null;
  barcode: string | null; mrp: number | string;
  sellingPrice: number | string; unitOfMeasure: string;
  quantity: number;
  // extra per-print fields
  packedDate?: string;
  bestBeforeDays?: string;
  netWeight?: string;
  batchNo?: string;
}

interface SearchResult {
  id: string; name: string; productCode: string | null;
  barcode: string | null; mrp: number | string;
  sellingPrice: number | string; unitOfMeasure: string;
}

// ─── Template definitions ─────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'packing',
    name: 'Packing Label',
    desc: 'Full shop info + barcode + packed date + FSSAI',
    size: '100mm × 50mm',
    width: 378, height: 189,   // px at 96dpi
    printW: '100mm', printH: '50mm',
  },
  {
    id: 'price_tag',
    name: 'Price Tag',
    desc: 'Name + barcode + MRP — small label',
    size: '40mm × 25mm',
    width: 151, height: 95,
    printW: '40mm', printH: '25mm',
  },
  {
    id: 'shelf',
    name: 'Shelf Label',
    desc: 'Name + MRP + SP + savings — shelf display',
    size: '75mm × 30mm',
    width: 284, height: 113,
    printW: '75mm', printH: '30mm',
  },
  {
    id: 'mrp_sticker',
    name: 'MRP Sticker',
    desc: 'Just MRP + barcode — quick restock sticker',
    size: '50mm × 25mm',
    width: 189, height: 95,
    printW: '50mm', printH: '25mm',
  },
  {
    id: 'full',
    name: 'Full Details',
    desc: 'All info: name + prices + category + code',
    size: '75mm × 50mm',
    width: 284, height: 189,
    printW: '75mm', printH: '50mm',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtPrice = (v: number | string) => Number(v).toFixed(2);
const todayDDMMYYYY = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
};

// ─── Barcode SVG (lazy JsBarcode) ─────────────────────────────────────────────

function BarcodeEl({ value, height, printMode }: { value: string; height: number; printMode?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!value || !ref.current) return;
    let cancelled = false;
    import('jsbarcode').then(({ default: JsBarcode }) => {
      if (cancelled || !ref.current) return;
      try {
        JsBarcode(ref.current, value, {
          format: 'CODE128', width: 1.6, height,
          displayValue: false, margin: 0,
          background: '#ffffff', lineColor: '#000000',
        });
      } catch {}
    });
    return () => { cancelled = true; };
  }, [value, height]);
  if (!value) return <div style={{ fontSize: 8, color: '#aaa', textAlign: 'center' }}>No barcode</div>;
  return <svg ref={ref} style={{ maxWidth: '100%' }} />;
}

// ─── TEMPLATE 1: Packing Label ────────────────────────────────────────────────

function PackingLabel({ p, biz, scale = 1, printMode }: {
  p: LabelProduct; biz: Business | null; scale?: number; printMode?: boolean;
}) {
  const s = (n: number) => printMode ? n : Math.round(n * scale);
  const sp = (n: number) => `${s(n)}px`;

  const shopName = biz?.name ?? 'SRIVANI STORE';
  const address  = biz?.address ?? 'Opp: New Bus Stand, Sangareddy, 502001';
  const phone    = biz?.phone ?? '93 82 82 84 84';
  const fssai    = biz?.fssaiLicense ?? '—';
  const barcode  = p.barcode ?? p.productCode ?? '';
  const packedDate = p.packedDate ?? todayDDMMYYYY();
  const netWeight  = p.netWeight ?? p.unitOfMeasure ?? '—';
  const bestBefore = p.bestBeforeDays ? `Best before ${p.bestBeforeDays} days from Packaging` : '';

  return (
    <div style={{
      width: printMode ? '100mm' : `${s(378)}px`,
      height: printMode ? '50mm' : `${s(189)}px`,
      border: printMode ? '1px solid #000' : '2px solid #222',
      borderRadius: printMode ? '3mm' : sp(11),
      padding: printMode ? '2mm 3mm' : `${sp(8)} ${sp(11)}`,
      background: '#fff', fontFamily: 'Arial, Helvetica, sans-serif',
      boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      gap: printMode ? '0.5mm' : sp(2),
      pageBreakAfter: printMode ? 'always' : 'auto',
    }}>
      {/* Shop header */}
      <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
        <div style={{ fontSize: printMode ? '9pt' : sp(14), fontWeight: 900, letterSpacing: 1 }}>{shopName}</div>
        <div style={{ fontSize: printMode ? '6pt' : sp(9) }}>{address}</div>
        <div style={{ fontSize: printMode ? '6pt' : sp(9), fontWeight: 700 }}>CUSTOMER CARE {phone}</div>
      </div>

      {/* Barcode */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
        <BarcodeEl value={barcode} height={printMode ? 30 : s(40)} printMode={printMode} />
        {barcode && <div style={{ fontSize: printMode ? '5.5pt' : sp(8), marginTop: 1 }}>{barcode}</div>}
      </div>

      {/* Product + Packed date row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: printMode ? '6.5pt' : sp(10), fontWeight: 700 }}>
        <span>PRODUCT: {p.name}</span>
        <span>PKD ON: {packedDate}</span>
      </div>

      {/* Net weight + Price row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: printMode ? '6.5pt' : sp(10) }}>
        <span style={{ fontWeight: 700 }}>Nt.Wt: {netWeight}</span>
        <span style={{ fontWeight: 900, fontSize: printMode ? '8pt' : sp(13) }}>Price: Rs {fmtPrice(p.sellingPrice)}</span>
      </div>

      {/* Best before */}
      {bestBefore && (
        <div style={{ textAlign: 'center', fontSize: printMode ? '6pt' : sp(9), fontWeight: 700 }}>{bestBefore}</div>
      )}

      {/* Exchange policy */}
      <div style={{ textAlign: 'center', fontSize: printMode ? '5.5pt' : sp(8), lineHeight: 1.3 }}>
        Please note : Exchange is only possible within 3 days(10am to 5pm only) from the billing date.
      </div>

      {/* FSSAI footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: printMode ? '5.5pt' : sp(8), borderTop: '0.5px solid #ccc', paddingTop: printMode ? '0.5mm' : sp(2) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: sp(3) }}>
          <span style={{ fontWeight: 900, color: '#008000', fontSize: printMode ? '6pt' : sp(9) }}>fssai</span>
          <span>{fssai}</span>
        </div>
        <span style={{ fontWeight: 700 }}>ONLY EXCHANGE - NO REFUND</span>
      </div>
    </div>
  );
}

// ─── TEMPLATE 2: Price Tag ────────────────────────────────────────────────────

function PriceTagLabel({ p, scale = 1, printMode }: { p: LabelProduct; scale?: number; printMode?: boolean }) {
  const s = (n: number) => printMode ? n : Math.round(n * scale);
  const barcode = p.barcode ?? p.productCode ?? '';
  const name = p.name.length > 22 ? p.name.slice(0, 22) + '…' : p.name;

  return (
    <div style={{
      width: printMode ? '40mm' : `${s(151)}px`,
      height: printMode ? '25mm' : `${s(95)}px`,
      border: printMode ? '0.5px solid #000' : '1px solid #ccc',
      borderRadius: printMode ? '2mm' : s(6),
      padding: printMode ? '1.5mm 2mm' : `${s(5)}px ${s(7)}px`,
      background: '#fff', fontFamily: 'Arial, Helvetica, sans-serif',
      boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      pageBreakAfter: printMode ? 'always' : 'auto',
    }}>
      <div style={{ fontSize: printMode ? '7pt' : s(10), fontWeight: 700, lineHeight: 1.2 }}>{name}</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <BarcodeEl value={barcode} height={printMode ? 22 : s(26)} printMode={printMode} />
      </div>
      {barcode && <div style={{ fontSize: printMode ? '5pt' : s(7), textAlign: 'center', letterSpacing: 0.5 }}>{barcode}</div>}
      <div style={{ fontSize: printMode ? '8pt' : s(11), fontWeight: 900, textAlign: 'center', marginTop: printMode ? '0.5mm' : s(2) }}>
        MRP: Rs.{fmtPrice(p.mrp)}
      </div>
    </div>
  );
}

// ─── TEMPLATE 3: Shelf Label ──────────────────────────────────────────────────

function ShelfLabel({ p, scale = 1, printMode }: { p: LabelProduct; scale?: number; printMode?: boolean }) {
  const s = (n: number) => printMode ? n : Math.round(n * scale);
  const mrp = Number(p.mrp);
  const sp2 = Number(p.sellingPrice);
  const saving = mrp > sp2 ? Math.round(((mrp - sp2) / mrp) * 100) : 0;

  return (
    <div style={{
      width: printMode ? '75mm' : `${s(284)}px`,
      height: printMode ? '30mm' : `${s(113)}px`,
      border: printMode ? '0.5px solid #000' : '1px solid #1B4F8A',
      borderRadius: printMode ? '2mm' : s(6),
      background: '#fff', fontFamily: 'Arial, Helvetica, sans-serif',
      boxSizing: 'border-box', overflow: 'hidden', display: 'flex',
      pageBreakAfter: printMode ? 'always' : 'auto',
    }}>
      {/* Left: info */}
      <div style={{ flex: 1, padding: printMode ? '2mm' : `${s(8)}px`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontSize: printMode ? '7pt' : s(11), fontWeight: 700, lineHeight: 1.2 }}>{p.name}</div>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: s(4) }}>
            <span style={{ fontSize: printMode ? '11pt' : s(17), fontWeight: 900, color: '#1B4F8A' }}>₹{fmtPrice(p.sellingPrice)}</span>
            {saving > 0 && <span style={{ fontSize: printMode ? '6pt' : s(9), color: '#888', textDecoration: 'line-through' }}>₹{fmtPrice(p.mrp)}</span>}
          </div>
          {saving > 0 && <div style={{ fontSize: printMode ? '6pt' : s(9), color: '#e53e3e', fontWeight: 700 }}>Save {saving}%</div>}
        </div>
        <div style={{ fontSize: printMode ? '5.5pt' : s(8), color: '#666' }}>{p.productCode}</div>
      </div>
      {/* Right: barcode */}
      <div style={{ width: printMode ? '28mm' : s(106), background: '#f9f9f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: printMode ? '1mm' : s(4) }}>
        <BarcodeEl value={p.barcode ?? p.productCode ?? ''} height={printMode ? 24 : s(40)} printMode={printMode} />
        <div style={{ fontSize: printMode ? '5pt' : s(7), marginTop: 1 }}>{p.barcode ?? ''}</div>
      </div>
    </div>
  );
}

// ─── TEMPLATE 4: MRP Sticker ──────────────────────────────────────────────────

function MrpSticker({ p, scale = 1, printMode }: { p: LabelProduct; scale?: number; printMode?: boolean }) {
  const s = (n: number) => printMode ? n : Math.round(n * scale);
  const barcode = p.barcode ?? p.productCode ?? '';

  return (
    <div style={{
      width: printMode ? '50mm' : `${s(189)}px`,
      height: printMode ? '25mm' : `${s(95)}px`,
      border: printMode ? '0.5px solid #000' : '1px solid #ccc',
      borderRadius: printMode ? '2mm' : s(6),
      padding: printMode ? '1.5mm 2mm 1mm' : `${s(5)}px ${s(7)}px ${s(3)}px`,
      background: '#fff', fontFamily: 'Arial, Helvetica, sans-serif',
      boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      pageBreakAfter: printMode ? 'always' : 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: printMode ? '6pt' : s(9), fontWeight: 700, maxWidth: '60%', lineHeight: 1.2 }}>{p.name}</div>
        <div style={{ fontSize: printMode ? '9pt' : s(13), fontWeight: 900, color: '#e53e3e' }}>₹{fmtPrice(p.mrp)}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <BarcodeEl value={barcode} height={printMode ? 22 : s(30)} printMode={printMode} />
      </div>
      {barcode && <div style={{ fontSize: printMode ? '5pt' : s(7), textAlign: 'center' }}>{barcode}</div>}
    </div>
  );
}

// ─── TEMPLATE 5: Full Details ─────────────────────────────────────────────────

function FullDetailsLabel({ p, biz, scale = 1, printMode }: { p: LabelProduct; biz: Business | null; scale?: number; printMode?: boolean }) {
  const s = (n: number) => printMode ? n : Math.round(n * scale);
  const barcode = p.barcode ?? p.productCode ?? '';
  const mrp = Number(p.mrp);
  const sp2 = Number(p.sellingPrice);
  const saving = mrp > sp2 ? Math.round(((mrp - sp2) / mrp) * 100) : 0;

  return (
    <div style={{
      width: printMode ? '75mm' : `${s(284)}px`,
      height: printMode ? '50mm' : `${s(189)}px`,
      border: printMode ? '0.5px solid #000' : '1px solid #222',
      borderRadius: printMode ? '2mm' : s(6),
      padding: printMode ? '2mm 2.5mm' : `${s(8)}px ${s(9)}px`,
      background: '#fff', fontFamily: 'Arial, Helvetica, sans-serif',
      boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: s(3),
      pageBreakAfter: printMode ? 'always' : 'auto',
    }}>
      <div style={{ textAlign: 'center', fontSize: printMode ? '8pt' : s(12), fontWeight: 900, borderBottom: '0.5px solid #ccc', paddingBottom: s(3) }}>{biz?.name ?? 'SRIVANI STORE'}</div>
      <div style={{ fontSize: printMode ? '7pt' : s(11), fontWeight: 700, lineHeight: 1.3 }}>{p.name}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: printMode ? '6pt' : s(9), color: '#555' }}>
        <span>Code: {p.productCode ?? '—'}</span>
        <span>UOM: {p.unitOfMeasure}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <BarcodeEl value={barcode} height={printMode ? 28 : s(40)} printMode={printMode} />
      </div>
      {barcode && <div style={{ fontSize: printMode ? '5pt' : s(7), textAlign: 'center' }}>{barcode}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '0.5px solid #eee', paddingTop: s(3) }}>
        <div>
          <div style={{ fontSize: printMode ? '8pt' : s(12), fontWeight: 900, color: '#1B4F8A' }}>₹{fmtPrice(p.sellingPrice)}</div>
          <div style={{ fontSize: printMode ? '5.5pt' : s(8), color: '#888', textDecoration: 'line-through' }}>MRP ₹{fmtPrice(p.mrp)}</div>
        </div>
        {saving > 0 && (
          <div style={{ background: '#e53e3e', color: '#fff', padding: `${s(2)}px ${s(5)}px`, borderRadius: s(4), fontSize: printMode ? '6pt' : s(9), fontWeight: 700 }}>
            {saving}% OFF
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Render label by template ID ─────────────────────────────────────────────

function LabelRenderer({ templateId, product, business, scale, printMode }: {
  templateId: string; product: LabelProduct; business: Business | null;
  scale?: number; printMode?: boolean;
}) {
  switch (templateId) {
    case 'packing':    return <PackingLabel    p={product} biz={business} scale={scale} printMode={printMode} />;
    case 'price_tag':  return <PriceTagLabel   p={product} scale={scale} printMode={printMode} />;
    case 'shelf':      return <ShelfLabel      p={product} scale={scale} printMode={printMode} />;
    case 'mrp_sticker':return <MrpSticker      p={product} scale={scale} printMode={printMode} />;
    case 'full':       return <FullDetailsLabel p={product} biz={business} scale={scale} printMode={printMode} />;
    default:           return <PriceTagLabel   p={product} scale={scale} printMode={printMode} />;
  }
}

// ─── Print area ───────────────────────────────────────────────────────────────

function PrintArea({ products, templateId, business }: {
  products: LabelProduct[]; templateId: string; business: Business | null;
}) {
  return (
    <div id="print-area" style={{ display: 'none' }}>
      {products.flatMap((p) =>
        Array.from({ length: p.quantity }, (_, qi) => (
          <LabelRenderer
            key={`${p.id}-${qi}`}
            templateId={templateId}
            product={p}
            business={business}
            printMode
          />
        ))
      )}
    </div>
  );
}

// ─── Extra fields panel per template ─────────────────────────────────────────

function ExtraFields({ templateId, product, onChange }: {
  templateId: string;
  product: LabelProduct;
  onChange: (patch: Partial<LabelProduct>) => void;
}) {
  if (templateId !== 'packing') return null;
  return (
    <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Packing Details</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Packed Date</label>
          <input type="text" value={product.packedDate ?? todayDDMMYYYY()}
            onChange={e => onChange({ packedDate: e.target.value })}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#1B4F8A]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Net Weight</label>
          <input type="text" value={product.netWeight ?? ''} placeholder="e.g. 1kg"
            onChange={e => onChange({ netWeight: e.target.value })}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#1B4F8A]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Best Before (days)</label>
          <input type="number" value={product.bestBeforeDays ?? ''} placeholder="e.g. 15"
            onChange={e => onChange({ bestBeforeDays: e.target.value })}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#1B4F8A]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Batch No.</label>
          <input type="text" value={product.batchNo ?? ''} placeholder="optional"
            onChange={e => onChange({ batchNo: e.target.value })}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#1B4F8A]" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

function LabelsPageInner() {
  const searchParams = useSearchParams();
  const [products, setProducts]       = useState<LabelProduct[]>([]);
  const [templateId, setTemplateId]   = useState('packing');
  const [loading, setLoading]         = useState(false);
  const [business, setBusiness]       = useState<Business | null>(null);
  const [search, setSearch]           = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen]   = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const tpl = TEMPLATES.find(t => t.id === templateId) ?? TEMPLATES[0];

  // Load business info
  useEffect(() => {
    api.get('/business').then(r => setBusiness(r.data)).catch(() => {});
  }, []);

  // Pre-fill from URL
  useEffect(() => {
    const id  = searchParams?.get('id');
    const ids = searchParams?.get('ids');
    const qty = searchParams?.get('qty');
    async function fetchProducts(idList: string[]) {
      setLoading(true);
      try {
        const results = await Promise.allSettled(idList.map(pid => api.get(`/products/${pid}`)));
        const loaded: LabelProduct[] = [];
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            const p = r.value.data;
            const qtyList = qty ? qty.split(',') : [];
            const q = Math.max(1, parseInt(qtyList[i] ?? '1') || 1);
            loaded.push({
              id: p.id, name: p.name, productCode: p.productCode ?? null,
              barcode: p.barcode ?? null, mrp: p.mrp, sellingPrice: p.sellingPrice,
              unitOfMeasure: p.unitOfMeasure, quantity: q,
              packedDate: todayDDMMYYYY(),
            });
          }
        });
        setProducts(loaded);
      } finally { setLoading(false); }
    }
    if (id) fetchProducts([id]);
    else if (ids) fetchProducts(ids.split(',').filter(Boolean));
  }, []); // eslint-disable-line

  // Close search on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Debounced product search
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/products', { params: { search: search.trim(), limit: 10 } });
        setSearchResults(res.data.data ?? []);
        setSearchOpen(true);
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function addProduct(p: SearchResult) {
    if (products.some(x => x.id === p.id)) { toast('Already in list'); return; }
    setProducts(prev => [...prev, {
      id: p.id, name: p.name, productCode: p.productCode ?? null,
      barcode: p.barcode ?? null, mrp: p.mrp, sellingPrice: p.sellingPrice,
      unitOfMeasure: p.unitOfMeasure, quantity: 1, packedDate: todayDDMMYYYY(),
    }]);
    setSearch(''); setSearchResults([]); setSearchOpen(false);
  }

  function removeProduct(id: string) { setProducts(prev => prev.filter(p => p.id !== id)); }

  function setQty(id: string, qty: number) {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, quantity: Math.max(1, Math.min(500, qty)) } : p));
  }

  function patchProduct(id: string, patch: Partial<LabelProduct>) {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }

  function handlePrint() {
    if (products.length === 0) { toast.error('No products selected'); return; }
    const el = document.getElementById('print-area');
    if (el) el.style.display = 'block';
    window.print();
    if (el) el.style.display = 'none';
  }

  const totalLabels = products.reduce((s, p) => s + p.quantity, 0);
  const previewProduct = products[0];

  // Scale preview to fit nicely
  const previewMaxW = 340;
  const previewScale = Math.min(1, previewMaxW / tpl.width);

  return (
    <>
      <Header title="Print Labels" />

      <style>{`
        @media print {
          @page { size: ${tpl.printW} ${tpl.printH}; margin: 0; }
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area {
            display: block !important;
            position: fixed !important;
            top: 0; left: 0; right: 0;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <main className="flex h-[calc(100vh-56px)] overflow-hidden no-print">

        {/* ── Left panel ── */}
        <div className="w-80 border-r border-gray-200 flex flex-col bg-white overflow-y-auto shrink-0">
          <div className="p-4 space-y-4">
            <BackButton fallbackHref="/dashboard/products" />

            {/* Template selector */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Label Template</p>
              <div className="space-y-1.5">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => setTemplateId(t.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-all text-sm ${
                      templateId === t.id
                        ? 'border-[#1B4F8A] bg-blue-50 text-[#1B4F8A]'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.size} — {t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Product search */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Products</p>
              <div className="relative" ref={searchRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                  placeholder="Search products…"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                />
                {searchOpen && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {searchResults.map(r => (
                      <button key={r.id} onClick={() => addProduct(r)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0">
                        <span className="font-medium text-gray-800">{r.name}</span>
                        <span className="ml-2 text-xs text-gray-400 font-mono">{r.barcode ?? r.productCode}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product list */}
              {loading && <div className="text-sm text-gray-400 text-center py-4">Loading…</div>}
              {!loading && products.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg mt-2">
                  Search above or open from Products page
                </div>
              )}

              <div className="space-y-2 mt-2">
                {products.map(p => (
                  <div key={p.id} className="bg-gray-50 rounded-lg px-3 py-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.barcode ?? p.productCode ?? '—'}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setQty(p.id, p.quantity - 1)}
                          className="w-5 h-5 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <input type="number" min={1} max={500} value={p.quantity}
                          onChange={e => setQty(p.id, parseInt(e.target.value) || 1)}
                          className="w-9 text-center text-xs border border-gray-200 rounded focus:outline-none py-0.5"
                        />
                        <button onClick={() => setQty(p.id, p.quantity + 1)}
                          className="w-5 h-5 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      <button onClick={() => removeProduct(p.id)} className="text-gray-300 hover:text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <ExtraFields templateId={templateId} product={p} onChange={patch => patchProduct(p.id, patch)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Print button */}
            <div className="border-t border-gray-200 pt-3 space-y-2">
              <p className="text-xs text-gray-500">
                {products.length} product{products.length !== 1 ? 's' : ''} · <strong>{totalLabels}</strong> label{totalLabels !== 1 ? 's' : ''} · {tpl.size}
              </p>
              <button onClick={handlePrint} disabled={products.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1B4F8A] text-white text-sm font-medium rounded-xl hover:bg-[#163f6e] disabled:opacity-50">
                <Printer className="w-4 h-4" />
                Print {totalLabels} Label{totalLabels !== 1 ? 's' : ''}
              </button>
              <p className="text-xs text-gray-400 text-center">Template: {tpl.name} · {tpl.size}</p>
            </div>
          </div>
        </div>

        {/* ── Right: Preview ── */}
        <div className="flex-1 bg-gray-100 overflow-y-auto p-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-4 text-center">Preview — {tpl.name}</p>

          {previewProduct ? (
            <div className="flex flex-col items-center gap-6">
              <LabelRenderer
                templateId={templateId}
                product={previewProduct}
                business={business}
                scale={previewScale}
              />
              <div className="text-xs text-gray-400 text-center space-y-0.5">
                <p>Actual size: {tpl.size}</p>
                <p>Preview scaled to fit</p>
              </div>

              {/* Show all products if multiple */}
              {products.length > 1 && (
                <div className="space-y-3 w-full max-w-sm">
                  <p className="text-xs text-gray-400 uppercase tracking-wide text-center">All Products</p>
                  {products.slice(1).map(p => (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="shrink-0" style={{ transform: `scale(${Math.min(0.6, previewScale)})`, transformOrigin: 'top left' }}>
                        <LabelRenderer templateId={templateId} product={p} business={business} scale={0.6} />
                      </div>
                      <div className="text-xs text-gray-500 ml-2">
                        <p className="font-medium text-gray-700 truncate max-w-[140px]">{p.name}</p>
                        <p>{p.quantity} label{p.quantity !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-3">
              <div className="text-4xl">🏷️</div>
              <p className="text-sm font-medium">Select a template and add products</p>
              <p className="text-xs">Preview will appear here</p>
            </div>
          )}
        </div>
      </main>

      {/* Hidden print area */}
      <PrintArea products={products} templateId={templateId} business={business} />
    </>
  );
}

export default function LabelsPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>}>
      <LabelsPageInner />
    </Suspense>
  );
}
