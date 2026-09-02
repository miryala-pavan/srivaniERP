// Set only by the deploy build (deploy-safe.ps1), which serves this app from
// shop.srivani.com/rider — local dev/build stay at the root path.
const basePath = process.env.RIDER_BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Capacitor's WebView loads a static bundle from disk — no Next.js server
  // at runtime, so this must be a fully client-rendered static export (no
  // API routes, no server actions). See the feature plan's Phase 2 section.
  output: 'export',
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  basePath,
  assetPrefix: basePath,
};

export default nextConfig;
