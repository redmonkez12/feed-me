import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import type { Environment } from '../config/environment';

export const REDIS_KEY_PREFIX = 'fd:';

export type RedisProbe = {
  key: string;
  value: string;
  expiresInSeconds: number;
};

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  readonly client: ReturnType<typeof createClient>;

  constructor(config: ConfigService<Environment, true>) {
    this.client = createClient({
      url: config.get('REDIS_URL', { infer: true }),
      keyPrefix: REDIS_KEY_PREFIX,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries >= 3) {
            return new Error('Redis connection retry limit reached');
          }

          return Math.min((retries + 1) * 100, 1_000);
        },
      },
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async writeProbe(scope: 'menus' | 'orders' | 'drivers'): Promise<RedisProbe> {
    const logicalKey = `lab:fd01:${scope}`;
    const value = `${scope}:ready`;

    await this.client.set(logicalKey, value, {
      expiration: { type: 'EX', value: 300 },
    });

    const [storedValue, expiresInSeconds] = await Promise.all([
      this.client.get(logicalKey),
      this.client.ttl(logicalKey),
    ]);

    if (storedValue === null) {
      throw new Error(`Redis probe ${logicalKey} disappeared before it could be read`);
    }

    return {
      key: `${REDIS_KEY_PREFIX}${logicalKey}`,
      value: storedValue,
      expiresInSeconds,
    };
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.close();
    }
  }
}
