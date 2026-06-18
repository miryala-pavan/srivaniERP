/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24, // 24 h — product images rarely change
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4001',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'api.srivani.com',
        pathname: '/uploads/**',
      },
      {
        // Google profile photos (served via next-auth Google OAuth)
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      // TODO: add Cloudinary pattern here once images are migrated
      // { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
    ],
  },

  async headers() {
    return [
      {
        // Security headers on every response
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // Immutable cache for hashed Next.js static assets
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Cache public images and fonts for 30 days
        source: '/(icons|fonts)/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' },
        ],
      },
    ];
  },
};

export default nextConfig;
