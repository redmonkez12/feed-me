import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports both dependencies as available', async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DatabaseService, useValue: { ping: vi.fn().mockResolvedValue(undefined) } },
        { provide: RedisService, useValue: { ping: vi.fn().mockResolvedValue('PONG') } },
      ],
    }).compile();

    await expect(module.get(HealthController).check()).resolves.toEqual({
      status: 'ok',
      services: { postgres: 'up', redis: 'up' },
    });
  });
});
