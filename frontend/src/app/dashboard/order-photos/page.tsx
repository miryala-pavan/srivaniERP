'use client';

import { useState, useRef } from 'react';
import { Camera, Search, Copy, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  customerCode: string | null;
}

export default function OrderPhotosPage() {
  const [custQuery, setCustQuery] = useState('');
  const [custResults, setCustResults] = useState<Customer[]>([]);
  const [showCustDrop, setShowCustDrop] = useState(false);
  const [custLoading, setCustLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const custTimer = useRef<ReturnType<typeof setTimeout>>();

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ waLink: string | null; staffMessage: string | null } | null>(null);

  // Doesn't require an existing WhatsApp conversation with a linked contact
  // (unlike the same action inside PaVa Connect's chat panel) — this page
  // picks the customer directly, so a brand-new "unlinked" WA contact isn't
  // a blocker here.
  function onCustInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setCustQuery(val);
    setSelectedCustomer(null);
    clearTimeout(custTimer.current);
    if (!val.trim()) { setCustResults([]); setShowCustDrop(false); return; }
    custTimer.current = setTimeout(async () => {
      setCustLoading(true);
      try {
        const res = await api.get<{ data: Customer[] }>('/customers', { params: { search: val } });
        setCustResults(res.data.data ?? []);
        setShowCustDrop(true);
      } catch { /* silent */ } finally { setCustLoading(false); }
    }, 300);
  }

  function pickCustomer(c: Customer) {
    setSelectedCustomer(c);
    setCustQuery(c.name);
    setShowCustDrop(false);
  }

  async function upload() {
    if (!selectedCustomer || !photoFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', photoFile);
      fd.append('customerId', selectedCustomer.id);
      if (photoCaption.trim()) fd.append('caption', photoCaption.trim());
      const { data } = await api.post('/order-photos', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult({ waLink: data.waLink, staffMessage: data.staffMessage });
      setPhotoFile(null);
      setPhotoCaption('');
      if (!data.waLink) toast.error('Photo uploaded, but no WhatsApp number is configured yet to build a share link');
      else toast.success('Photo uploaded — message ready to copy');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setSelectedCustomer(null);
    setCustQuery('');
    setCustResults([]);
    setPhotoFile(null);
    setPhotoCaption('');
    setResult(null);
  }

  return (
    <>
      <Header title="Order Photos" />
      <main className="flex-1 p-6 space-y-5 max-w-2xl">
        <p className="text-sm text-gray-500">
          Upload a photo (e.g. a packed order) for any customer, then copy the ready-to-send
          WhatsApp message — no need for an existing chat with them first.
        </p>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="relative">
            <label className="label text-xs">Customer</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input text-sm pl-9"
                placeholder="Search by name, phone, or code…"
                value={custQuery}
                onChange={onCustInput}
                onFocus={() => custResults.length > 0 && setShowCustDrop(true)}
              />
            </div>
            {showCustDrop && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {custLoading ? (
                  <div className="px-3 py-2 text-xs text-gray-400">Searching…</div>
                ) : custResults.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-400">No customers found</div>
                ) : (
                  custResults.map(c => (
                    <button
                      key={c.id}
                      onClick={() => pickCustomer(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span className="text-gray-800">{c.name}</span>
                      <span className="text-xs text-gray-400">{c.phone ? `+91 ${c.phone}` : c.customerCode}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {selectedCustomer && (
            <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-teal-800">{selectedCustomer.name}</p>
                {selectedCustomer.phone && <p className="text-xs text-teal-600">+91 {selectedCustomer.phone}</p>}
              </div>
              <button onClick={() => { setSelectedCustomer(null); setCustQuery(''); }} className="text-teal-500 hover:text-teal-700">
                <X size={16} />
              </button>
            </div>
          )}

          <div>
            <label className="label text-xs">Photo</label>
            <input type="file" accept="image/jpeg,image/png,image/webp"
              onChange={e => setPhotoFile(e.target.files?.[0] ?? null)}
              className="input text-sm" />
          </div>

          <div>
            <label className="label text-xs">Caption (optional)</label>
            <input className="input text-sm" placeholder="e.g. Your order, packed and ready!"
              value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} />
          </div>

          <button
            onClick={upload}
            disabled={!selectedCustomer || !photoFile || uploading}
            className="w-full btn-primary text-sm py-2.5 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Camera size={15} />
            {uploading ? 'Uploading…' : 'Upload & Generate Link'}
          </button>
        </div>

        {result && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Ready to Share</h2>
            {result.staffMessage ? (
              <>
                <p className="text-xs text-gray-500">Copy this and send it to the customer from your own personal WhatsApp:</p>
                <textarea readOnly value={result.staffMessage} rows={8}
                  className="input text-xs w-full font-mono" onFocus={e => e.currentTarget.select()} />
                <button
                  onClick={() => { navigator.clipboard.writeText(result.staffMessage!); toast.success('Copied'); }}
                  className="w-full btn-primary text-sm py-2.5 flex items-center justify-center gap-2"
                >
                  <Copy size={14} /> Copy Message
                </button>
              </>
            ) : (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No WhatsApp number is configured yet — activate a phone number preset in Settings first.
              </p>
            )}
            <button onClick={reset} className="w-full py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors">
              Share Another Photo
            </button>
          </div>
        )}
      </main>
    </>
  );
}
