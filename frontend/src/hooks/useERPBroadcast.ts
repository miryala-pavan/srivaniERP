import { useEffect, useRef } from 'react';

const CHANNEL = 'srivani_erp';

export type ERPMessage =
  | { type: 'PRODUCT_ADDED';   id: string; name: string; barcode?: string }
  | { type: 'PRODUCT_UPDATED'; id: string; name: string }
  | { type: 'SUPPLIER_ADDED';  id: string; name: string }
  | { type: 'CUSTOMER_ADDED';  id: string; name: string };

export function useERPBroadcast(onMessage: (msg: ERPMessage) => void) {
  const cbRef = useRef(onMessage);
  useEffect(() => { cbRef.current = onMessage; });

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (e) => cbRef.current(e.data as ERPMessage);
    return () => ch.close();
  }, []);
}

export function broadcastERP(msg: ERPMessage) {
  if (typeof BroadcastChannel === 'undefined') return;
  const ch = new BroadcastChannel(CHANNEL);
  ch.postMessage(msg);
  ch.close();
}
