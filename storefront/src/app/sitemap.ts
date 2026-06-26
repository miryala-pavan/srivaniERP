import type { MetadataRoute } from 'next';
import { getCategories, getProducts } from '@/lib/shop';

export const revalidate = 3600; // regenerate every hour

const NOW = new Date();

const STATIC: MetadataRoute.Sitemap = [
  { url: '',          changeFrequency: 'daily',   priority: 1.0, lastModified: NOW },
  { url: '/products', changeFrequency: 'daily',   priority: 0.9, lastModified: NOW },
  { url: '/deals',    changeFrequency: 'daily',   priority: 0.8, lastModified: NOW },
  { url: '/search',   changeFrequency: 'weekly',  priority: 0.5, lastModified: NOW },
  { url: '/about',    changeFrequency: 'monthly', priority: 0.5, lastModified: NOW },
  { url: '/contact',  changeFrequency: 'monthly', priority: 0.5, lastModified: NOW },
  { url: '/privacy-policy',   changeFrequency: 'yearly',  priority: 0.3 },
  { url: '/terms-of-service', changeFrequency: 'yearly',  priority: 0.3 },
  { url: '/data-deletion',    changeFrequency: 'yearly',  priority: 0.3 },
  { url: '/shipping',         changeFrequency: 'yearly',  priority: 0.3 },
  { url: '/refund',           changeFrequency: 'yearly',  priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:4002').replace(/\/$/, '');

  const staticRoutes = STATIC.map(r => ({ ...r, url: `${BASE}${r.url}` }));

  // ── Categories ──────────────────────────────────────────────────────────────
  const categoryRoutes: MetadataRoute.Sitemap = [];
  try {
    const cats = await getCategories();
    for (const cat of cats) {
      categoryRoutes.push({
        url: `${BASE}/category/${cat.code}`,
        changeFrequency: 'daily',
        priority: 0.8,
      });
      for (const sub of cat.subcategories) {
        categoryRoutes.push({
          url: `${BASE}/category/${sub.code}`,
          changeFrequency: 'daily',
          priority: 0.7,
        });
      }
    }
  } catch { /* backend down at build time — skip */ }

  // ── Products (paginate through all) ─────────────────────────────────────────
  const productRoutes: MetadataRoute.Sitemap = [];
  try {
    let page = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = await getProducts({ page, limit: 200 });
      for (const p of result.data) {
        productRoutes.push({
          url: `${BASE}/product/${p.code}`,
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
      if (page >= result.totalPages || result.totalPages === 0) break;
      page++;
    }
  } catch { /* backend down at build time — skip */ }

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
