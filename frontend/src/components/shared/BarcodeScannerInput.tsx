'use client';

import { forwardRef } from 'react';
import { Camera, X, Search } from 'lucide-react';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';

interface Props {
  value:           string;
  onChange:        (value: string) => void;
  placeholder?:    string;
  /** Extra classes on the outer wrapper div */
  className?:      string;
  /** Classes applied directly to the <input>. Defaults to a standard style with pl-9 pr-9. */
  inputClassName?: string;
  /** Show a magnifying-glass icon on the left (default true) */
  showSearchIcon?: boolean;
  autoFocus?:      boolean;
  onKeyDown?:      (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?:        (e: React.FocusEvent<HTMLInputElement>) => void;
  id?:             string;
  type?:           string;
}

export const BarcodeScannerInput = forwardRef<HTMLInputElement, Props>(
  (
    {
      value, onChange, placeholder, className, inputClassName,
      showSearchIcon = true, autoFocus, onKeyDown, onFocus, id, type = 'text',
    },
    ref,
  ) => {
    const { showCamera, cameraError, cameraSupported, videoRef, startCamera, stopCamera } =
      useBarcodeScanner((code) => onChange(code));

    const defaultInputClass = showSearchIcon
      ? 'w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]'
      : 'w-full pl-3 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]';

    return (
      <div className={className}>
        <div className="relative">
          {showSearchIcon && (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          )}

          <input
            ref={ref}
            id={id}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            className={inputClassName ?? defaultInputClass}
          />

          <button
            type="button"
            onClick={cameraSupported ? (showCamera ? stopCamera : startCamera) : undefined}
            title={
              !cameraSupported
                ? 'Camera scanning requires Chrome on Android or Safari 17+ on iPhone'
                : showCamera
                ? 'Stop camera'
                : 'Scan barcode or QR code'
            }
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors ${
              !cameraSupported
                ? 'text-gray-300 cursor-default'
                : showCamera
                ? 'text-red-500 hover:text-red-700'
                : 'text-blue-600 hover:text-blue-800'
            }`}
          >
            {showCamera ? <X className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          </button>
        </div>

        {/* Inline camera strip */}
        {showCamera && (
          <div
            className="mt-1.5 rounded-xl overflow-hidden border border-gray-200 bg-black relative"
            style={{ height: 140 }}
          >
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-green-400 opacity-80 animate-pulse" />
            <p className="absolute bottom-1 left-0 right-0 text-center text-white text-[10px] opacity-70">
              Point at barcode or QR · Scanning automatically
            </p>
          </div>
        )}

        {cameraError && (
          <p className="text-xs text-red-500 mt-1">{cameraError}</p>
        )}
      </div>
    );
  },
);

BarcodeScannerInput.displayName = 'BarcodeScannerInput';
