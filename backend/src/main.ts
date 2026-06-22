import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// Last-resort guards so a stray rejection/exception is logged instead of
// silently killing the process with an opaque crash.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

async function bootstrap() {
  // rawBody:true keeps the raw request buffer available for the WhatsApp
  // webhook signature check; useBodyParser raises the size limit so base64
  // image/PDF uploads (e.g. /lists/manual) aren't rejected as 413.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.useBodyParser('json',       { limit: '25mb' });
  app.useBodyParser('urlencoded', { limit: '25mb', extended: true });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  app.enableCors({
    // Allow localhost + LAN devices + Vercel deployments + Cloudflare Tunnels.
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin / curl / mobile apps
      const allowed = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()) ?? [];
      const ok =
        /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):(4000|4002)$/.test(origin) ||
        /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
        /^https:\/\/[\w-]+\.vercel\.app$/.test(origin) ||
        /^https:\/\/[\w-]+\.trycloudflare\.com$/.test(origin) ||
        /^https:\/\/[\w.-]+\.srivani\.com$/.test(origin) ||
        allowed.includes(origin);
      cb(ok ? null : new Error('Not allowed by CORS'), ok);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const imagesDir = process.env.PRODUCT_IMAGES_DIR
    ?? path.join(process.cwd(), '..', 'storage', 'product-images');
  fs.mkdirSync(imagesDir, { recursive: true });
  app.useStaticAssets(imagesDir, { prefix: '/uploads/products' });

  const proofsDir = process.env.PAYMENT_PROOFS_DIR
    ?? path.join(process.cwd(), '..', 'storage', 'payment-proofs');
  fs.mkdirSync(proofsDir, { recursive: true });
  app.useStaticAssets(proofsDir, { prefix: '/uploads/payment-proofs' });

  const port = process.env.PORT || 4001;
  await app.listen(port);
  console.log(`Srivani ERP API running on: http://localhost:${port}/api`);
  console.log(`Health check: http://localhost:${port}/api/health`);
}
bootstrap().catch((err) => {
  const msg = String(err?.message ?? err);
  if (msg.includes('P1001') || msg.includes("Can't reach database")) {
    console.error('\n❌ Cannot reach the database.');
    console.error('   Make sure the PostgreSQL container is running (Docker Desktop + `docker compose up -d`).');
    console.error('   Expected at the DATABASE_URL host/port in your .env (default localhost:4432).\n');
  } else if (msg.includes('EADDRINUSE')) {
    console.error('\n❌ Port already in use — another instance of the API may already be running.\n');
  } else {
    console.error('\n❌ Failed to start Srivani ERP API:\n', err);
  }
  process.exit(1);
});
