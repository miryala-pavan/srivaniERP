'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Download, RefreshCw, Upload, Plus, X, CheckCircle2,
  Clock, AlertCircle, RotateCcw, User, Phone, Image, MessageSquare, FileIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface WaList {
  id:          string;
  senderName:  string | null;
  senderPhone: string;
  msgType:     'TEXT' | 'IMAGE' | 'DOCUMENT' | 'PDF';
  rawText:     string | null;
  ocrText:     string | null;
  docReady:    boolean;
  status:      'PENDING' | 'PROCESSING' | 'READY' | 'DOWNLOADED';
  errorMsg:    string | null;
  receivedAt:  string;
}

const STATUS_CONFIG = {
  PENDING:     { label: 'Pending',     color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: <Clock size={11} /> },
  PROCESSING:  { label: 'Processing',  color: 'bg-blue-50 text-blue-700 border-blue-200',       icon: <RefreshCw size={11} className="animate-spin" /> },
  READY:       { label: 'Ready',       color: 'bg-green-50 text-green-700 border-green-200',     icon: <CheckCircle2 size={11} /> },
  DOWNLOADED:  { label: 'Downloaded',  color: 'bg-gray-100 text-gray-500 border-gray-200',       icon: <CheckCircle2 size={11} /> },
};

const TYPE_ICON = {
  TEXT:     <MessageSquare size={14} className="text-blue-500" />,
  IMAGE:    <Image size={14} className="text-purple-500" />,
  DOCUMENT: <FileIcon size={14} className="text-orange-500" />,
  PDF:      <FileText size={14} className="text-red-500" />,
};

export default function ListsPage() {
  const [lists, setLists]           = useState<WaList[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [showManual, setShowManual] = useState(false);
  const [expanded, setExpanded]     = useState<string | null>(null);

  // Manual form
  const [mName,  setMName]  = useState('');
  const [mPhone, setMPhone] = useState('');
  const [mText,  setMText]  = useState('');
  const [mFile,  setMFile]  = useState<{ base64: string; mime: string; name: string; kind: 'image' | 'pdf' | 'docx' } | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef  = useRef<HTMLInputElement>(null);
  const docRef   = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/lists?page=${page}&limit=30`);
      setLists(data.items);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load lists');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 10s to catch processing completions
  useEffect(() => {
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  async function download(id: string) {
    try {
      const res = await api.get(`/lists/${id}/download`, { responseType: 'blob' });
      const cd  = res.headers['content-disposition'] ?? '';
      const match = cd.match(/filename="(.+)"/);
      const name  = match ? decodeURIComponent(match[1]) : 'list.docx';
      const url   = URL.createObjectURL(new Blob([res.data]));
      const a     = document.createElement('a');
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
      toast.success('Downloaded!');
      load();
    } catch {
      toast.error('Download failed');
    }
  }

  async function reprocess(id: string) {
    try {
      await api.post(`/lists/${id}/reprocess`);
      toast.success('Requeued for processing');
      load();
    } catch {
      toast.error('Reprocess failed');
    }
  }

  function readFile(file: File, kind: 'image' | 'pdf' | 'docx') {
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1];
      setMFile({ base64: b64, mime: file.type, name: file.name, kind });
    };
    reader.readAsDataURL(file);
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file, 'image');
  }

  function handleDocPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const kind = file.type.includes('pdf') ? 'pdf' : 'docx';
    readFile(file, kind);
  }

  async function saveManual() {
    if (!mName.trim() || !mPhone.trim()) return toast.error('Name and phone are required');
    if (!mText.trim() && !mFile) return toast.error('Enter a text list or upload a file');
    setSaving(true);
    try {
      const body: Record<string, string> = {
        senderName:  mName.trim(),
        senderPhone: mPhone.replace(/\D/g, ''),
      };
      if (mText.trim())           body.text        = mText.trim();
      if (mFile?.kind === 'image') { body.imageBase64 = mFile.base64; body.imageMime = mFile.mime; }
      if (mFile?.kind === 'pdf' || mFile?.kind === 'docx') { body.fileBase64 = mFile.base64; body.fileMime = mFile.mime; }

      await api.post('/lists/manual', body);
      toast.success('Done — your doc is ready to download!');
      setShowManual(false);
      setMName(''); setMPhone(''); setMText(''); setMFile(null);
      setTimeout(load, 1500);
    } catch {
      toast.error('Failed to create list');
    } finally {
      setSaving(false);
    }
  }

  const pages = Math.ceil(total / 30);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="text-blue-600" size={22} />
            <h1 className="text-xl font-semibold text-gray-900">Order Lists</h1>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 ml-8">
            WhatsApp lists auto-converted to print-ready Word docs
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-outline flex items-center gap-1.5 text-sm">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={() => setShowManual(v => !v)}
            className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={13} /> Manual Entry
          </button>
        </div>
      </div>

      {/* Webhook info banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex items-start gap-3">
        <MessageSquare size={16} className="mt-0.5 flex-shrink-0 text-blue-500" />
        <div>
          <span className="font-medium">Auto-receive setup:</span> When customers send messages to your WhatsApp Business number,
          lists appear here automatically and convert to print-ready docs.
          {' '}Use <strong>Manual Entry</strong> for messages received on your personal WhatsApp.
        </div>
      </div>

      {/* Manual entry form */}
      {showManual && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-blue-900">Manual Entry</h2>
            <button onClick={() => setShowManual(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-sm">Customer Name</label>
              <input className="input" placeholder="Shankar" value={mName} onChange={e => setMName(e.target.value)} />
            </div>
            <div>
              <label className="label text-sm">Phone Number</label>
              <input className="input" placeholder="9382828484" value={mPhone} onChange={e => setMPhone(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label text-sm">Text List (paste WhatsApp text)</label>
            <textarea rows={6} className="input font-mono text-sm"
              placeholder={"100gm zeera\n1kg chane\n2 gold drop oil\n..."}
              value={mText} onChange={e => setMText(e.target.value)} />
          </div>

          <div className="text-center text-xs text-gray-400 font-medium">— OR upload a file —</div>

          {mFile ? (
            <div className="flex items-center justify-between bg-white border border-green-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-green-700">
                {mFile.kind === 'image' ? <Image size={16} /> : mFile.kind === 'pdf' ? <FileText size={16} /> : <FileIcon size={16} />}
                <span className="text-sm font-medium">{mFile.name}</span>
                <span className="text-xs bg-green-100 px-1.5 py-0.5 rounded text-green-600 uppercase">{mFile.kind}</span>
              </div>
              <button onClick={() => setMFile(null)} className="text-gray-400 hover:text-red-500">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* Image upload */}
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Image size={20} className="mx-auto mb-1.5 text-purple-400" />
                <p className="text-sm font-medium text-gray-700">Upload Image</p>
                <p className="text-xs text-gray-400 mt-0.5">JPG, PNG — handwritten list</p>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
              </div>

              {/* PDF / DOCX upload */}
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors"
                onClick={() => docRef.current?.click()}
              >
                <FileText size={20} className="mx-auto mb-1.5 text-orange-400" />
                <p className="text-sm font-medium text-gray-700">Upload PDF / Word</p>
                <p className="text-xs text-gray-400 mt-0.5">.pdf or .docx — text extracted</p>
                <input ref={docRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleDocPick} />
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setShowManual(false)} className="btn-outline text-sm">Cancel</button>
            <button onClick={saveManual} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Generating doc…' : 'Generate Document'}
            </button>
          </div>
        </div>
      )}

      {/* Lists */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          {total} list{total !== 1 ? 's' : ''}
        </p>

        {loading && lists.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
        ) : lists.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl text-gray-400">
            <FileText size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No lists yet.</p>
            <p className="text-xs mt-1">Lists appear here when customers send messages to your WhatsApp Business number,<br />or use Manual Entry above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lists.map(item => {
              const st  = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;
              const isOpen = expanded === item.id;
              const date = new Date(item.receivedAt);
              const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
              const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={item.id}
                  className={`bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow
                    ${item.docReady ? 'border-l-4 border-l-green-500' : item.status === 'PROCESSING' ? 'border-l-4 border-l-blue-400' : 'border-l-4 border-l-gray-300'}`}>

                  {/* Main row */}
                  <div className="flex items-center gap-3 p-3.5 cursor-pointer" onClick={() => setExpanded(isOpen ? null : item.id)}>
                    <div className="shrink-0">{TYPE_ICON[item.msgType]}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-900">
                          {item.senderName ?? item.senderPhone}
                        </span>
                        {item.senderName && (
                          <span className="text-xs text-gray-400">{item.senderPhone}</span>
                        )}
                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border ${st.color}`}>
                          {st.icon} {st.label}
                        </span>
                      </div>
                      {item.rawText && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{item.rawText.split('\n')[0]}</p>
                      )}
                      {item.ocrText && !item.rawText && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate italic">OCR: {item.ocrText.split('\n')[0]}</p>
                      )}
                      {item.errorMsg && (
                        <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                          <AlertCircle size={10} /> {item.errorMsg}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-gray-400">{dateStr} {timeStr}</span>

                      {item.docReady && (
                        <button
                          onClick={e => { e.stopPropagation(); download(item.id); }}
                          className="flex items-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg px-2.5 py-1.5 transition-colors font-medium">
                          <Download size={12} /> Download
                        </button>
                      )}
                      {(item.status === 'PENDING' || item.errorMsg) && (
                        <button
                          onClick={e => { e.stopPropagation(); reprocess(item.id); }}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 rounded-lg px-2 py-1.5 transition-colors">
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-2">
                      <div className="flex gap-6 text-xs text-gray-500">
                        <span><span className="font-medium">Type:</span> {item.msgType}</span>
                        <span><span className="font-medium">Status:</span> {item.status}</span>
                        <span><span className="font-medium">Received:</span> {new Date(item.receivedAt).toLocaleString('en-IN')}</span>
                      </div>
                      {item.rawText && (
                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-1">Message text:</p>
                          <pre className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-3 whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">
                            {item.rawText}
                          </pre>
                        </div>
                      )}
                      {item.ocrText && (
                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-1">OCR extracted text:</p>
                          <pre className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-3 whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">
                            {item.ocrText}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={`text-xs px-3 py-1.5 rounded-lg border ${p === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Local sync info */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-700 mb-1">Auto-save to <code className="text-xs bg-gray-200 px-1 rounded">D:\shop\LIST\new\</code></p>
        <p className="text-xs">Run the <strong>srivani-sync.py</strong> script on this PC to automatically download new docs to your local folder as they arrive.
          The script checks every 30 seconds and saves files in the same folder structure you already use.</p>
      </div>
    </div>
  );
}
