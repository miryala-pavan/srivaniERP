'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, Loader2, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const IMG_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/api$/, '');
const NOIMAGE  = `${IMG_BASE}/uploads/products/noimage.svg`;

interface Props {
  imageUrl?:   string | null;
  updatedAt?:  string | number | null;
  size:        'thumb' | 'large';
  alt?:        string;
  /** If provided, image becomes clickable — shows preview + change/delete options */
  productId?:  string;
  /** Called after a successful upload/delete so the parent can refetch */
  onUpdated?:  () => void;
}

export function ProductImage({
  imageUrl, updatedAt, size, alt = 'Product', productId, onUpdated,
}: Props) {
  const [errored,     setErrored]     = useState(false);
  const [open,        setOpen]        = useState(false);   // modal open
  const [uploading,   setUploading]   = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [previewSrc,  setPreviewSrc]  = useState<string | null>(null); // local preview before upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setErrored(false); }, [imageUrl]);

  // Close modal on Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);

  function closeModal() {
    setOpen(false);
    setPreviewSrc(null);
    setSelectedFile(null);
  }

  const sizeClass = size === 'thumb'
    ? 'w-10 h-10 rounded object-cover'
    : 'w-full h-full object-contain rounded-lg';

  const imgSrc = (!imageUrl || errored)
    ? NOIMAGE
    : `${IMG_BASE}${imageUrl}${updatedAt ? `?v=${updatedAt}` : ''}`;

  // ── File picked ────────────────────────────────────────────────────────────
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  // ── Upload ──────────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!selectedFile || !productId) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', selectedFile);
      await api.post(`/products/${productId}/image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Image updated');
      onUpdated?.();
      closeModal();
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!productId) return;
    if (!confirm('Remove this product image?')) return;
    setDeleting(true);
    try {
      await api.delete(`/products/${productId}/image`);
      toast.success('Image removed');
      onUpdated?.();
      closeModal();
    } catch {
      toast.error('Failed to remove image');
    } finally {
      setDeleting(false);
    }
  }

  const clickable = !!productId;

  return (
    <>
      {/* ── Image element ──────────────────────────────────────────────── */}
      <div
        className={`relative group ${clickable ? 'cursor-pointer' : ''}`}
        onClick={clickable ? () => setOpen(true) : undefined}
        title={clickable ? 'Click to view / change image' : undefined}
      >
        <img
          src={imgSrc}
          alt={alt}
          className={sizeClass}
          onError={() => setErrored(true)}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        {/* Camera overlay badge on hover (only when clickable) */}
        {clickable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded">
            <Camera className="w-4 h-4 text-white drop-shadow" />
          </div>
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      {open && clickable && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 truncate max-w-[220px]">{alt}</h3>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Image preview area */}
            <div className="bg-gray-50 flex items-center justify-center" style={{ height: 240 }}>
              <img
                src={previewSrc ?? imgSrc}
                alt={alt}
                className="max-h-full max-w-full object-contain p-3"
                onError={() => {}}
              />
            </div>

            {/* If a new file was picked — show confirm / cancel */}
            {selectedFile ? (
              <div className="px-5 py-4 space-y-2">
                <p className="text-xs text-gray-500 text-center truncate">{selectedFile.name}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedFile(null); setPreviewSrc(null); }}
                    className="flex-1 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex-1 py-2 text-sm font-semibold bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163f6e] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : 'Save Image'}
                  </button>
                </div>
              </div>
            ) : (
              /* Normal state — Change / Remove buttons */
              <div className="px-5 py-4 flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 py-2 text-sm font-medium bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163f6e] flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" /> Change Image
                </button>
                {imageUrl && !errored && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="py-2 px-3 text-sm border border-red-200 text-red-600 rounded-xl hover:bg-red-50 disabled:opacity-50 flex items-center gap-1"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
        onClick={e => { (e.target as HTMLInputElement).value = ''; }}
      />
    </>
  );
}
