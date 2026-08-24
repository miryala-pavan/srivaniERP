'use client';

import { useState, useRef } from 'react';
import { Camera, Search, Copy, X, CheckCircle2, AlertCircle, Images } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  customerCode: string | null;
}

interface PhotoJob {
  id: string;
  file: File;
  previewUrl: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'done' | 'error';
  waLink?: string | null;
  staffMessage?: string | null;
  errorMsg?: string;
}

let jobSeq = 0;

export default function OrderPhotosPage() {
  const [custQuery, setCustQuery] = useState('');
  const [custResults, setCustResults] = useState<Customer[]>([]);
  const [showCustDrop, setShowCustDrop] = useState(false);
  const [custLoading, setCustLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const custTimer = useRef<ReturnType<typeof setTimeout>>();

  const [jobs, setJobs] = useState<PhotoJob[]>([]);
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadingAll, setUploadingAll] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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

  function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const newJobs: PhotoJob[] = files.map(file => ({
      id: `j${++jobSeq}`,
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: 'pending',
    }));
    setJobs(prev => [...prev, ...newJobs]);
    e.target.value = ''; // allow re-picking the same file(s) later
  }

  function removeJob(id: string) {
    setJobs(prev => {
      const job = prev.find(j => j.id === id);
      if (job) URL.revokeObjectURL(job.previewUrl);
      return prev.filter(j => j.id !== id);
    });
  }

  function updateJob(id: string, patch: Partial<PhotoJob>) {
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, ...patch } : j)));
  }

  // Uploads one job at a time (not in parallel) so each file's progress bar
  // fills independently and predictably, and one photo's failure never
  // blocks the rest of the batch from uploading.
  async function uploadAll() {
    if (!selectedCustomer) return;
    const pending = jobs.filter(j => j.status === 'pending' || j.status === 'error');
    if (pending.length === 0) return;

    setUploadingAll(true);
    for (const job of pending) {
      updateJob(job.id, { status: 'uploading', progress: 0, errorMsg: undefined });
      try {
        const fd = new FormData();
        fd.append('file', job.file);
        fd.append('customerId', selectedCustomer.id);
        if (photoCaption.trim()) fd.append('caption', photoCaption.trim());

        const { data } = await api.post('/order-photos', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (evt) => {
            if (!evt.total) return;
            updateJob(job.id, { progress: Math.round((evt.loaded / evt.total) * 100) });
          },
        });

        updateJob(job.id, {
          status: 'done', progress: 100,
          waLink: data.waLink, staffMessage: data.staffMessage,
        });
      } catch (e: any) {
        updateJob(job.id, {
          status: 'error',
          errorMsg: e?.response?.data?.message ?? 'Upload failed',
        });
      }
    }
    setUploadingAll(false);

    const finished = jobs.length;
    const failed = jobs.filter(j => j.status === 'error').length;
    if (failed === 0) toast.success(finished === 1 ? 'Photo uploaded' : `All ${finished} photos uploaded`);
    else toast.error(`${failed} photo${failed === 1 ? '' : 's'} failed to upload — you can retry below`);
  }

  function reset() {
    jobs.forEach(j => URL.revokeObjectURL(j.previewUrl));
    setSelectedCustomer(null);
    setCustQuery('');
    setCustResults([]);
    setJobs([]);
    setPhotoCaption('');
  }

  const hasPending = jobs.some(j => j.status === 'pending' || j.status === 'error');
  const allDone = jobs.length > 0 && jobs.every(j => j.status === 'done');

  return (
    <>
      <Header title="Order Photos" />
      <main className="flex-1 p-6 space-y-5 max-w-2xl">
        <p className="text-sm text-gray-500">
          Upload one or more photos (e.g. a packed order) for any customer, then copy each
          ready-to-send WhatsApp message — no need for an existing chat with them first.
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
            <label className="label text-xs">Photos</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors"
              >
                <Camera size={15} /> Take Photo
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors"
              >
                <Images size={15} /> Choose Photos
              </button>
            </div>
            {/* capture="environment" opens the device's back camera directly
                on mobile instead of a file/gallery picker. Kept as a separate
                input (no `multiple`) since browsers treat capture-mode inputs
                as one shot per tap — tapping "Take Photo" again after a shot
                adds another job, so multiple photos still works, just one
                capture at a time like a real camera app. */}
            <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              capture="environment" onChange={onFilesPicked} className="hidden" />
            <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              multiple onChange={onFilesPicked} className="hidden" />
            <p className="text-[11px] text-gray-400 mt-1">Take photos one at a time, or choose several from your gallery at once.</p>
          </div>

          <div>
            <label className="label text-xs">Caption (optional, applied to all selected photos)</label>
            <input className="input text-sm" placeholder="e.g. Your order, packed and ready!"
              value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} />
          </div>

          <button
            onClick={uploadAll}
            disabled={!selectedCustomer || !hasPending || uploadingAll}
            className="w-full btn-primary text-sm py-2.5 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Camera size={15} />
            {uploadingAll ? 'Uploading…' : `Upload${jobs.length > 1 ? ` All (${jobs.length})` : ''} & Generate Link${jobs.length > 1 ? 's' : ''}`}
          </button>
        </div>

        {jobs.length > 0 && (
          <div className="space-y-3">
            {jobs.map(job => (
              <div key={job.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={job.previewUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-gray-200" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-gray-700 truncate">{job.file.name}</p>
                      {job.status === 'pending' && (
                        <button onClick={() => removeJob(job.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                          <X size={14} />
                        </button>
                      )}
                      {job.status === 'done' && <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />}
                      {job.status === 'error' && <AlertCircle size={16} className="text-red-500 flex-shrink-0" />}
                    </div>

                    {job.status === 'uploading' && (
                      <div className="mt-2">
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500 transition-all duration-150"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">{job.progress}%</p>
                      </div>
                    )}

                    {job.status === 'pending' && (
                      <p className="text-[11px] text-gray-400 mt-1">Waiting to upload…</p>
                    )}

                    {job.status === 'error' && (
                      <p className="text-[11px] text-red-500 mt-1">{job.errorMsg} — will retry on next upload</p>
                    )}
                  </div>
                </div>

                {/* Only appears once THIS photo's upload has actually finished — never before. */}
                {job.status === 'done' && (
                  job.staffMessage ? (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      <textarea readOnly value={job.staffMessage} rows={6}
                        className="input text-xs w-full font-mono" onFocus={e => e.currentTarget.select()} />
                      <button
                        onClick={() => { navigator.clipboard.writeText(job.staffMessage!); toast.success('Copied'); }}
                        className="w-full btn-primary text-sm py-2 flex items-center justify-center gap-2"
                      >
                        <Copy size={14} /> Copy Message
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Uploaded, but no WhatsApp number is configured yet to build a share link.
                    </p>
                  )
                )}
              </div>
            ))}

            {allDone && (
              <button onClick={reset} className="w-full py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors">
                Share Another Batch
              </button>
            )}
          </div>
        )}
      </main>
    </>
  );
}
