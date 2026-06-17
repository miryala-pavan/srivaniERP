import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Srivani Stores',
    short_name: 'Srivani',
    description: 'Fresh groceries from Srivani Stores, Sangareddy. Pure, Trust & Quality since 1983.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAF3E4',
    theme_color: '#D98324',
    orientation: 'portrait-primary',
    categories: ['shopping', 'food'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/logo.png',           sizes: '290x290', type: 'image/png', purpose: 'any' },
    ],
    screenshots: [],
  };
}
