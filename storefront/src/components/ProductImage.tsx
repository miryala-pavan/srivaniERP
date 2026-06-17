'use client';

import { useState } from 'react';

const IMG_BASE = process.env.NEXT_PUBLIC_IMG_BASE ?? 'http://localhost:4001';

interface Props {
  imageUrl: string | null;
  alt: string;
  className?: string;
}

export default function ProductImage({ imageUrl, alt, className = '' }: Props) {
  const initial = imageUrl ? `${IMG_BASE}${imageUrl}` : '/noimage.png';
  const [src, setSrc] = useState(initial);

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setSrc('/noimage.png')}
      className={className}
    />
  );
}
