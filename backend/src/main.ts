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
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  app.enableCors({
    origin: [
      'http://localhost:4000',
      'http://localhost:4002',
      process.env.FRONTEND_URL || 'http://localhost:4000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const imagesDir = process.env.PRODUCT_IMAGES_DIR
    ?? path.join(process.cwd(), '..', 'storage', 'product-images');
  fs.mkdirSync(imagesDir, { recursive: true });
  app.useStaticAssets(imagesDir, { prefix: '/uploads/products' });

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
