import sharp from '../node_modules/sharp/lib/index.js';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src    = resolve(__dirname, '../frontend/public/icons/logo512x512.png');
const outDir = resolve(__dirname, '../frontend/public/icons');
const appDir = resolve(__dirname, '../frontend/src/app');
const pubDir = resolve(__dirname, '../frontend/public');

mkdirSync(outDir, { recursive: true });

const sizes = [
  { name: 'pwa-512.png',          size: 512 },
  { name: 'pwa-192.png',          size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32x32.png',    size: 32  },
  { name: 'favicon-16x16.png',    size: 16  },
];

for (const { name, size } of sizes) {
  await sharp(src)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(resolve(outDir, name));
  console.log(`✅ icons/${name} (${size}x${size})`);
}

// favicon.ico at app root
await sharp(src)
  .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toFile(resolve(appDir, 'favicon.ico'));
console.log('✅ src/app/favicon.ico');

// apple-touch-icon at public root (iOS standard location)
await sharp(src)
  .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toFile(resolve(pubDir, 'apple-touch-icon.png'));
console.log('✅ public/apple-touch-icon.png');

console.log('\n🎉 All icons generated!');
