import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class ShopCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(ShopCacheService.name);
  private readonly redis: Redis | null;

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.redis = null;
      return;
    }
    try {
      this.redis = new Redis(url, {
        lazyConnect: true,
        enableOfflineQueue: false,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
      });
      this.redis.on('error', () => {
        // Intentionally silent — Redis is optional; the shop falls back to DB.
      });
    } catch {
      this.redis = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Redis unavailable — silent fallback
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(key);
    } catch {
      // Silent fallback
    }
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }
}
