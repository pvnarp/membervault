import { logger } from './logger.js';

let redisClient: import('ioredis').default | null = null;

export async function getRedis(url?: string): Promise<import('ioredis').default | null> {
  if (!url) return null;
  if (redisClient) return redisClient;

  try {
    const Redis = (await import('ioredis')).default;
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
    });

    redisClient.on('error', (err) => {
      logger.warn({ err: err.message }, 'Redis connection error — falling back to in-memory');
    });

    await redisClient.connect();
    logger.info('Redis connected');
    return redisClient;
  } catch {
    logger.warn('Redis unavailable — using in-memory rate limiting');
    redisClient = null;
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
