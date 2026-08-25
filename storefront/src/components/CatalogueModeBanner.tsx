'use client';

import { useStoreConfig } from '@/context/StoreConfigContext';

export default function CatalogueModeBanner() {
  const { catalogueMode } = useStoreConfig();
  if (!catalogueMode) return null;

  return (
    <div
      style={{
        background: '#2C1B10',
        color: '#F4E9DA',
        textAlign: 'center',
        fontSize: '12.5px',
        fontWeight: 600,
        letterSpacing: '0.2px',
        padding: '8px 12px',
      }}
    >
      Browsing only right now — prices and ordering are temporarily switched off. Please check back soon, or call the store directly.
    </div>
  );
}
