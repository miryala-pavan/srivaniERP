'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import type { Delivery, UploadedPhoto } from '@/lib/types';

// In-page camera capture (getUserMedia + canvas), deliberately NOT the
// native file-picker/camera-app route — this is the only way to guarantee
// the photo never touches the rider's own gallery. See the plan's "Key
// architecture decisions" for the full reasoning. Each capture auto-uploads
// immediately; nothing is cached client-side once the request completes.
export default function ConfirmDeliveryScreen({
  delivery, onDone, onBack,
}: {
  delivery: Delivery;
  onDone: () => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [cashCollected, setCashCollected] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFail, setShowFail] = useState(false);
  const [failReason, setFailReason] = useState('');

  useEffect(() => () => stopCamera(), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
    } catch {
      setError('Could not access the camera — check camera permission');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function capture() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return;

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', blob, 'delivery-photo.jpg');
      const res = await api.post<UploadedPhoto>(`/rider/deliveries/${delivery.id}/photos`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotos((prev) => [...prev, res.data]);
    } catch {
      setError('Photo upload failed — try again');
    } finally {
      setUploading(false);
    }
  }

  const needsCash = delivery.codAmount != null;
  const canSubmit = photos.length > 0 && /^\d{4}$/.test(otpCode) && (!needsCash || cashCollected);

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/rider/deliveries/${delivery.id}/confirm`, {
        otpCode,
        cashCollected: needsCash ? cashCollected : undefined,
        photoIds: photos.map((p) => p.id),
      });
      stopCamera();
      onDone();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not confirm delivery');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitFail() {
    if (!failReason.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/rider/deliveries/${delivery.id}/fail`, { reason: failReason.trim() });
      stopCamera();
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  if (showFail) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <button onClick={() => setShowFail(false)} className="mb-4 text-sm text-slate-500">← Back</button>
        <h2 className="mb-2 text-lg font-bold text-slate-900">Report a problem</h2>
        <textarea
          value={failReason}
          onChange={(e) => setFailReason(e.target.value)}
          placeholder="What went wrong? (customer not reachable, wrong address, refused order...)"
          className="w-full rounded-lg border border-slate-300 p-3 text-sm"
          rows={4}
        />
        <button
          onClick={submitFail}
          disabled={!failReason.trim() || submitting}
          className="mt-4 w-full rounded-lg bg-red-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          Mark as failed delivery
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-4 py-4 shadow-sm">
        <button onClick={onBack} className="text-sm text-slate-500">← Back</button>
        <button onClick={() => setShowFail(true)} className="text-sm text-red-600">Report a problem</button>
      </div>

      <div className="space-y-4 px-4 pt-4">
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold text-slate-900">1. Photos of the delivered items</h2>
          {cameraOn ? (
            <div className="space-y-2">
              <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black" />
              <div className="flex gap-2">
                <button
                  onClick={capture}
                  disabled={uploading}
                  className="flex-1 rounded-lg bg-blue-600 py-2.5 font-semibold text-white disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : `📷 Capture (${photos.length})`}
                </button>
                <button onClick={stopCamera} className="rounded-lg bg-slate-100 px-4 py-2.5 font-semibold text-slate-600">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <button onClick={startCamera} className="w-full rounded-lg bg-slate-100 py-2.5 font-semibold text-slate-700">
              📷 Open camera {photos.length > 0 && `(${photos.length} captured)`}
            </button>
          )}
          {photos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((p) => (
                <img key={p.id} src={p.imageUrl} alt="Captured" className="h-16 w-16 rounded-md object-cover" />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold text-slate-900">2. Delivery OTP</h2>
          <p className="mb-2 text-xs text-slate-500">Ask the customer to read out the code they received.</p>
          <input
            type="tel"
            inputMode="numeric"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="4-digit OTP"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg tracking-widest"
          />
        </section>

        {needsCash && (
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold text-slate-900">3. Cash collected</h2>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={cashCollected}
                onChange={(e) => setCashCollected(e.target.checked)}
                className="h-5 w-5"
              />
              Collected ₹{delivery.codAmount} in cash
            </label>
          </section>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={confirm}
          disabled={!canSubmit || submitting}
          className="w-full rounded-lg bg-green-600 py-3 font-semibold text-white disabled:opacity-40"
        >
          {submitting ? 'Confirming…' : 'Mark Delivered'}
        </button>
      </div>
    </div>
  );
}
