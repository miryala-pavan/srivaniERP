'use client';

import { useWishlist, type WishlistItem } from '@/context/WishlistContext';

interface Props extends WishlistItem {
  size?: 'sm' | 'lg';
}

export default function WishlistButton({ size = 'sm', ...item }: Props) {
  const { has, toggle } = useWishlist();
  const saved = has(item.code);
  const dim = size === 'lg' ? 38 : 28;
  const iconSz = size === 'lg' ? 20 : 15;

  return (
    <button
      type="button"
      onClick={e => { e.preventDefault(); e.stopPropagation(); toggle(item); }}
      aria-label={saved ? 'Remove from favourites' : 'Add to favourites'}
      title={saved ? 'Remove from favourites' : 'Add to favourites'}
      style={{
        width: dim, height: dim,
        borderRadius: '50%',
        background: saved ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.88)',
        border: `1.5px solid ${saved ? '#ef4444' : 'rgba(180,180,180,0.5)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        backdropFilter: 'blur(4px)',
        transition: 'all 0.15s',
        padding: 0,
      }}
    >
      <svg
        width={iconSz} height={iconSz} viewBox="0 0 24 24"
        fill={saved ? '#ef4444' : 'none'}
        stroke={saved ? '#ef4444' : '#999'}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>
  );
}
