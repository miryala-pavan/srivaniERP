import type { CapacitorConfig } from '@capacitor/cli';

// webDir points at Next's static export output ("next build" with
// output:'export' in next.config.mjs writes to ./out). Run `npm run
// cap:sync` (build + `npx cap sync`) before opening the native project so
// the bundled web assets are current.
const config: CapacitorConfig = {
  appId: 'com.srivanistores.rider',
  appName: 'Srivani Rider',
  webDir: 'out',
};

export default config;
