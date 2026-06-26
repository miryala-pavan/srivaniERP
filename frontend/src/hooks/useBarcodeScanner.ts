import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';

export interface BarcodeScannerHook {
  showCamera:      boolean;
  cameraError:     string;
  cameraSupported: boolean;
  videoRef:        React.RefObject<HTMLVideoElement>;
  startCamera:     () => void;
  stopCamera:      () => void;
}

export function useBarcodeScanner(onScan: (code: string) => void): BarcodeScannerHook {
  const [showCamera,      setShowCamera]      = useState(false);
  const [cameraError,     setCameraError]     = useState('');
  const [cameraSupported, setCameraSupported] = useState(false);

  const videoRef     = useRef<HTMLVideoElement>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const onScanRef    = useRef(onScan);
  onScanRef.current  = onScan;

  useEffect(() => {
    setCameraSupported('BarcodeDetector' in window);
  }, []);

  const stopCamera = useCallback(() => {
    if (scanFrameRef.current) cancelAnimationFrame(scanFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
    setCameraError('');
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = useCallback(async () => {
    if (!('BarcodeDetector' in window)) {
      toast.error('Camera scanning not supported. Use Chrome on Android or Safari 17+ on iPhone.');
      return;
    }
    setCameraError('');
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new (window as any).BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'],
      });
      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          scanFrameRef.current = requestAnimationFrame(scan);
          return;
        }
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            stopCamera();
            onScanRef.current(barcodes[0].rawValue);
          } else {
            scanFrameRef.current = requestAnimationFrame(scan);
          }
        } catch {
          scanFrameRef.current = requestAnimationFrame(scan);
        }
      };
      scanFrameRef.current = requestAnimationFrame(scan);
    } catch (err: any) {
      setCameraError(err?.message ?? 'Camera access denied');
      setShowCamera(false);
    }
  }, [stopCamera]);

  return { showCamera, cameraError, cameraSupported, videoRef, startCamera, stopCamera };
}
