import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.setGlobalPrefix('api');
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:4000',
      process.env.FRONTEND_URL || 'http://localhost:4000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Srivani ERP API running on: http://localhost:${port}/api`);
  console.log(`❤️  Health check: http://localhost:${port}/api/health`);
}
bootstrap();