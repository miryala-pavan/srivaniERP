/** @type {import('next').NextConfig} */
const nextConfig = {
  // Capacitor's WebView loads a static bundle from disk — no Next.js server
  // at runtime, so this must be a fully client-rendered static export (no
  // API routes, no server actions). See the feature plan's Phase 2 section.
  output: 'export',
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
