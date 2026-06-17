const sharp = require('../node_modules/sharp');
const { mkdirSync } = require('fs');
const { resolve } = require('path');

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

async function run() {
  for (const { name, size } of sizes) {
    await sharp(src)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(resolve(outDir, name));
    console.log(`✅ icons/${name} (${size}x${size})`);
  }

  await sharp(src)
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(resolve(appDir, 'favicon.ico'));
  console.log('✅ src/app/favicon.ico');

  await sharp(src)
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(resolve(pubDir, 'apple-touch-icon.png'));
  console.log('✅ public/apple-touch-icon.png');

  console.log('\n🎉 All icons generated!');
}

run().catch(console.error);
