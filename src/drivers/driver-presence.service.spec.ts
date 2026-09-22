import { describe, expect, it } from 'vitest';
import { createRedisDouble } from '../../test/doubles/redis-double';
import { RedisService } from '../redis/redis.service';
import { DriverPresenceService } from './driver-presence.service';

describe('DriverPresenceService.setOnline', () => {
  it('idempotently adds and removes an existing driver in the online Set', async () => {
    const { client, hashes, sets } = createRedisDouble();
    const service = new DriverPresenceService({ client } as unknown as RedisService);
    hashes.set('driver:d1', { name: 'Adam' });

    await expect(service.setOnline('d1', true)).resolves.toBe(true);
    await expect(service.setOnline('d1', true)).resolves.toBe(false);
    expect(sets.get('drivers:online')).toContain('d1');

    await expect(service.setOnline('d1', false)).resolves.toBe(true);
    await expect(service.setOnline('d1', false)).resolves.toBe(false);
    expect(sets.get('drivers:online')).toBeUndefined();
  });

  it('does not add a missing driver to the online Set', async () => {
    const { client, sets } = createRedisDouble();
    const service = new DriverPresenceService({ client } as unknown as RedisService);

    await expect(service.setOnline('missing', true)).resolves.toBeNull();
    expect(sets.get('drivers:online')).toBeUndefined();
    expect(client.sAdd).not.toHaveBeenCalled();
  });
});
