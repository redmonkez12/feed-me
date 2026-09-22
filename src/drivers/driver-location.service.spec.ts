import { describe, expect, it } from 'vitest';
import { createRedisDouble } from '../../test/doubles/redis-double';
import { RedisService } from '../redis/redis.service';
import { DriverLocationService } from './driver-location.service';

describe('DriverLocationService.updateLocation', () => {
  it('updates only the GEO position and reports whether it changed', async () => {
    const { client, hashes, positions } = createRedisDouble();
    const service = new DriverLocationService({ client } as unknown as RedisService);
    hashes.set('driver:d1', { name: 'Adam' });
    positions.set('geo:drivers:d1', {
      longitude: 16.6075,
      latitude: 49.1955,
      member: 'd1',
    });

    await expect(service.updateLocation('d1', 16.61, 49.2)).resolves.toBe(true);
    await expect(service.updateLocation('d1', 16.61, 49.2)).resolves.toBe(false);
    expect(positions.get('geo:drivers:d1')).toEqual({
      longitude: 16.61,
      latitude: 49.2,
      member: 'd1',
    });
    expect(client.geoAdd).toHaveBeenLastCalledWith(
      'geo:drivers',
      { longitude: 16.61, latitude: 49.2, member: 'd1' },
      { CH: true },
    );
  });

  it('does not create a GEO member for a missing driver', async () => {
    const { client, positions } = createRedisDouble();
    const service = new DriverLocationService({ client } as unknown as RedisService);

    await expect(service.updateLocation('missing', 16.61, 49.2)).resolves.toBeNull();
    expect(positions.has('geo:drivers:missing')).toBe(false);
    expect(client.geoAdd).not.toHaveBeenCalled();
  });

  it('rejects coordinates outside the Redis GEO range', async () => {
    const { client, hashes } = createRedisDouble();
    const service = new DriverLocationService({ client } as unknown as RedisService);
    hashes.set('driver:d1', { name: 'Adam' });

    await expect(service.updateLocation('d1', 181, 49.2)).rejects.toThrow();
    expect(client.geoAdd).not.toHaveBeenCalled();
  });
});
