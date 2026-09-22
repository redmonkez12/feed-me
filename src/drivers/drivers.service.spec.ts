import { describe, expect, it } from 'vitest';
import { createRedisDouble } from '../../test/doubles/redis-double';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { DriverLocationService } from './driver-location.service';
import { DriverPresenceService } from './driver-presence.service';
import { DriversService } from './drivers.service';
import type { DriverSeed } from './drivers.types';

function createService(client: ReturnType<typeof createRedisDouble>['client']): DriversService {
  const redis = { client } as unknown as RedisService;
  return new DriversService(
    {} as DatabaseService,
    redis,
    new DriverPresenceService(redis),
    new DriverLocationService(redis),
  );
}

describe('DriversService.seedDriver', () => {
  it('stores profile, online membership, and location through their dedicated services', async () => {
    const { client, hashes, sets, positions } = createRedisDouble();
    const service = createService(client);
    const driver: DriverSeed = {
      id: 'd1',
      name: 'Adam',
      longitude: 16.6075,
      latitude: 49.1955,
      online: true,
      busy: false,
    };
    const firstImport = new Date('2026-09-22T08:00:00.000Z');
    const secondImport = new Date('2026-09-22T09:00:00.000Z');

    const firstResult = await service.seedDriver(driver, firstImport);
    hashes.get('driver:d1')!.completedDeliveries = '7';
    const secondResult = await service.seedDriver(
      { ...driver, online: false, busy: true },
      secondImport,
    );

    expect(firstResult).toEqual({
      id: 'd1',
      name: 'Adam',
      busy: false,
      createdAt: firstImport,
      completedDeliveries: 0,
    });
    expect(secondResult).toMatchObject({
      id: 'd1',
      busy: true,
      createdAt: firstImport,
      completedDeliveries: 7,
    });
    expect(sets.get('drivers:online')).toBeUndefined();
    expect(positions.get('geo:drivers:d1')).toEqual({
      longitude: 16.6075,
      latitude: 49.1955,
      member: 'd1',
    });
  });
});

describe('DriversService.getDriver', () => {
  it('returns a typed driver profile parsed from Redis Hash strings', async () => {
    const { client, hashes } = createRedisDouble();
    const service = createService(client);
    const createdAt = new Date('2026-09-22T08:00:00.000Z');

    hashes.set('driver:d1', {
      name: 'Adam',
      busy: 'false',
      completedDeliveries: '7',
      createdAt: createdAt.toISOString(),
    });

    await expect(service.getDriver('d1')).resolves.toEqual({
      id: 'd1',
      name: 'Adam',
      busy: false,
      completedDeliveries: 7,
      createdAt,
    });
  });

  it('returns null for a missing driver', async () => {
    const { client } = createRedisDouble();
    const service = createService(client);

    await expect(service.getDriver('missing')).resolves.toBeNull();
  });

  it('rejects an invalid boolean stored in the driver Hash', async () => {
    const { client, hashes } = createRedisDouble();
    const service = createService(client);

    hashes.set('driver:d1', {
      name: 'Adam',
      busy: 'not-a-boolean',
      completedDeliveries: '0',
      createdAt: '2026-09-22T08:00:00.000Z',
    });

    await expect(service.getDriver('d1')).rejects.toThrow();
  });
});

describe('DriversService.incrementCompletedDeliveries', () => {
  it('atomically increments the counter and returns its new value', async () => {
    const { client, hashes } = createRedisDouble();
    const service = createService(client);

    hashes.set('driver:d1', {
      name: 'Adam',
      busy: 'false',
      completedDeliveries: '7',
      createdAt: '2026-09-22T08:00:00.000Z',
    });

    await expect(service.incrementCompletedDeliveries('d1')).resolves.toBe(8);
    await expect(service.incrementCompletedDeliveries('d1')).resolves.toBe(9);
    expect(hashes.get('driver:d1')?.completedDeliveries).toBe('9');
  });

  it('does not create a partial Hash for a missing driver', async () => {
    const { client, hashes } = createRedisDouble();
    const service = createService(client);

    await expect(service.incrementCompletedDeliveries('missing')).resolves.toBeNull();
    expect(hashes.has('driver:missing')).toBe(false);
  });
});
