import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:4002').replace(/\/$/, '');
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/_next/'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
