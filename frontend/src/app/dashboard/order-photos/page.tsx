'use client';

import { useState, useRef } from 'react';
import { Camera, Search, Copy, X, CheckCircle2, AlertCircle, Images, ImagePlus, Loader2, MessageCircle } from 'lucide-react';
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

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
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();

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

  // Re-fires on every press, not just the first — clearing and restarting
  // the timer means pressing again while "Copied!" is still showing resets
  // the 2s window instead of getting stuck or silently doing nothing.
  function copyMessage(jobId: string, text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Message copied');
    clearTimeout(copiedTimer.current);
    setCopiedJobId(jobId);
    copiedTimer.current = setTimeout(() => setCopiedJobId(null), 2000);
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
  const doneCount = jobs.filter(j => j.status === 'done').length;

  return (
    <>
      <Header
        title="Order Photos"
        icon={
          <span className="w-7 h-7 rounded-lg bg-[#1B4F8A]/10 flex items-center justify-center">
            <ImagePlus className="w-4 h-4 text-[#1B4F8A]" />
          </span>
        }
      />
      <main className="flex-1 bg-gray-50 min-h-[calc(100vh-56px)]">
        <div className="max-w-3xl mx-auto p-6 space-y-6">

          {/* Intro strip */}
          <div className="rounded-2xl bg-gradient-to-br from-[#1B4F8A] to-[#123a68] px-6 py-5 text-white shadow-sm">
            <h1 className="text-lg font-bold">Share a packed order photo</h1>
            <p className="text-sm text-blue-100 mt-1 max-w-xl">
              Pick a customer, snap or choose photos, then copy the ready-to-send WhatsApp message —
              no existing chat with them needed.
            </p>
          </div>

          {/* Step 1: Customer */}
          <section className="relative z-20 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2.5 px-5 pt-5">
              <span className="w-6 h-6 rounded-full bg-[#1B4F8A] text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
              <h2 className="text-sm font-semibold text-gray-800">Choose customer</h2>
            </div>
            <div className="p-5 pt-3">
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#1B4F8A] focus:ring-2 focus:ring-[#1B4F8A]/10 outline-none transition-colors"
                    placeholder="Search by name, phone, or code…"
                    value={custQuery}
                    onChange={onCustInput}
                    onFocus={() => custResults.length > 0 && setShowCustDrop(true)}
                  />
                </div>
                {showCustDrop && (
                  <div className="absolute z-10 mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {custLoading ? (
                      <div className="px-4 py-3 text-xs text-gray-400 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
                      </div>
                    ) : custResults.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-gray-400">No customers found</div>
                    ) : (
                      custResults.map(c => (
                        <button
                          key={c.id}
                          onClick={() => pickCustomer(c)}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                        >
                          <span className="w-8 h-8 rounded-full bg-[#1B4F8A]/10 text-[#1B4F8A] text-xs font-bold flex items-center justify-center shrink-0">
                            {initials(c.name)}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-gray-800 font-medium truncate">{c.name}</span>
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">{c.phone ? `+91 ${c.phone}` : c.customerCode}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {selectedCustomer && (
                <div className="mt-3 flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
                  <span className="w-9 h-9 rounded-full bg-teal-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {initials(selectedCustomer.name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-teal-900 truncate">{selectedCustomer.name}</p>
                    {selectedCustomer.phone && <p className="text-xs text-teal-600">+91 {selectedCustomer.phone}</p>}
                  </div>
                  <button
                    onClick={() => { setSelectedCustomer(null); setCustQuery(''); }}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-teal-500 hover:text-teal-700 hover:bg-teal-100 transition-colors shrink-0"
                    aria-label="Clear selected customer"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Step 2: Photos */}
          <section className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-opacity ${!selectedCustomer ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2.5 px-5 pt-5">
              <span className="w-6 h-6 rounded-full bg-[#1B4F8A] text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
              <h2 className="text-sm font-semibold text-gray-800">Add photos</h2>
              {jobs.length > 0 && (
                <span className="text-xs font-medium text-gray-400 ml-auto">{jobs.length} selected</span>
              )}
            </div>

            <div className="p-5 pt-3 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/60 hover:bg-teal-50 hover:border-teal-300 transition-colors"
                >
                  <span className="w-11 h-11 rounded-full bg-teal-600 flex items-center justify-center shadow-sm">
                    <Camera className="w-5 h-5 text-white" />
                  </span>
                  <span className="text-sm font-semibold text-teal-800">Take Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                >
                  <span className="w-11 h-11 rounded-full bg-gray-500 flex items-center justify-center shadow-sm">
                    <Images className="w-5 h-5 text-white" />
                  </span>
                  <span className="text-sm font-semibold text-gray-700">Choose Photos</span>
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
              <p className="text-xs text-gray-400 -mt-1">Take photos one at a time, or choose several from your gallery at once.</p>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Caption <span className="font-normal text-gray-400">(optional, applied to all selected photos)</span></label>
                <input
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#1B4F8A] focus:ring-2 focus:ring-[#1B4F8A]/10 outline-none transition-colors"
                  placeholder="e.g. Your order, packed and ready!"
                  value={photoCaption} onChange={e => setPhotoCaption(e.target.value)}
                />
              </div>

              <button
                onClick={uploadAll}
                disabled={!selectedCustomer || !hasPending || uploadingAll}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#1B4F8A] hover:bg-[#163f70] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {uploadingAll ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                {uploadingAll ? 'Uploading…' : `Upload${jobs.length > 1 ? ` All (${jobs.length})` : ''} & Generate Link${jobs.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </section>

          {/* Step 3: Results */}
          {jobs.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2.5 px-1">
                <span className="w-6 h-6 rounded-full bg-[#1B4F8A] text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                <h2 className="text-sm font-semibold text-gray-800">Ready to share</h2>
                {jobs.length > 0 && (
                  <span className="text-xs font-medium text-gray-400 ml-auto">{doneCount}/{jobs.length} done</span>
                )}
              </div>

              {jobs.map(job => (
                <div
                  key={job.id}
                  className={`bg-white rounded-2xl border shadow-sm p-4 transition-colors ${
                    job.status === 'error' ? 'border-red-200' : job.status === 'done' ? 'border-emerald-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={job.previewUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
                      {job.status === 'uploading' && (
                        <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{job.progress}%</span>
                        </div>
                      )}
                      {job.status === 'done' && (
                        <span className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                          <CheckCircle2 size={11} className="text-white" />
                        </span>
                      )}
                      {job.status === 'error' && (
                        <span className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
                          <AlertCircle size={11} className="text-white" />
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-gray-700 font-medium truncate">{job.file.name}</p>
                        {job.status === 'pending' && (
                          <button onClick={() => removeJob(job.id)} className="text-gray-300 hover:text-gray-500 flex-shrink-0 transition-colors">
                            <X size={15} />
                          </button>
                        )}
                      </div>

                      {job.status === 'uploading' && (
                        <div className="mt-2.5">
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#1B4F8A] transition-all duration-150" style={{ width: `${job.progress}%` }} />
                          </div>
                        </div>
                      )}

                      {job.status === 'pending' && (
                        <p className="text-xs text-gray-400 mt-1">Waiting to upload…</p>
                      )}

                      {job.status === 'error' && (
                        <p className="text-xs text-red-500 mt-1">{job.errorMsg} — will retry on next upload</p>
                      )}

                      {job.status === 'done' && !job.staffMessage && (
                        <p className="text-xs text-amber-600 mt-1">No WhatsApp number configured — can&apos;t build a share link</p>
                      )}
                    </div>
                  </div>

                  {/* Only appears once THIS photo's upload has actually finished — never before. */}
                  {job.status === 'done' && job.staffMessage && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2.5">
                      <div className="flex items-start gap-2 text-xs text-gray-400">
                        <MessageCircle size={13} className="mt-0.5 shrink-0" />
                        <span>Copy this and send it to the customer from your own personal WhatsApp:</span>
                      </div>
                      <textarea readOnly value={job.staffMessage} rows={5}
                        className="w-full px-3 py-2.5 text-xs font-mono rounded-xl border border-gray-200 bg-gray-50 outline-none resize-none"
                        onFocus={e => e.currentTarget.select()} />
                      <button
                        onClick={() => copyMessage(job.id, job.staffMessage!)}
                        className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                          copiedJobId === job.id
                            ? 'bg-emerald-500 text-white'
                            : 'bg-[#1B4F8A] text-white hover:bg-[#163f70]'
                        }`}
                      >
                        {copiedJobId === job.id
                          ? <><CheckCircle2 size={14} /> Copied!</>
                          : <><Copy size={14} /> Copy Message</>}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {allDone && (
                <button onClick={reset} className="w-full py-2.5 text-sm bg-white border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-xl font-medium transition-colors">
                  Share Another Batch
                </button>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
