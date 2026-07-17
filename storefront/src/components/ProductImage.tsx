'use client';

import { useState } from 'react';

const IMG_BASE = process.env.NEXT_PUBLIC_IMG_BASE ?? 'http://localhost:4001';

interface Props {
  imageUrl: string | null;
  alt: string;
  className?: string;
}

export default function ProductImage({ imageUrl, alt, className = '' }: Props) {
  const src = imageUrl ? `${IMG_BASE}${imageUrl}` : '/noimage.png';
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const finalSrc = errored ? '/noimage.png' : src;

  return (
    <span style={{ position: 'relative', display: 'block', width: '100%', height: '100%' }}>
      {/* Shimmer skeleton — visible until image loads */}
      {!loaded && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, var(--paper-2,#f5f0e8) 25%, var(--paper,#faf6ef) 50%, var(--paper-2,#f5f0e8) 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite',
            borderRadius: '4px',
          }}
        />
      )}
      <img
        src={finalSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => { setErrored(true); setLoaded(true); }}
        className={className}
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.25s ease' }}
      />
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </span>
  );
}
