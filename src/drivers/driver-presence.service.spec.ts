import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRedisDouble } from '../../test/doubles/redis-double';
import { RedisService } from '../redis/redis.service';
import { DriverPresenceService } from './driver-presence.service';

afterEach(() => {
  vi.useRealTimers();
});

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

describe('DriverPresenceService heartbeat', () => {
  it('atomically stores a heartbeat with a 15-second TTL', async () => {
    const set = vi.fn().mockResolvedValue('OK');
    const service = new DriverPresenceService({
      client: { set },
    } as unknown as RedisService);

    await service.heartbeat('d1');

    expect(set).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith('driver:d1:heartbeat', '1', {
      expiration: { type: 'EX', value: 15 },
    });
  });

  it('reports whether the driver heartbeat key exists', async () => {
    const exists = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const service = new DriverPresenceService({
      client: { exists },
    } as unknown as RedisService);

    await expect(service.isAlive('d1')).resolves.toBe(true);
    await expect(service.isAlive('d1')).resolves.toBe(false);
    expect(exists).toHaveBeenCalledTimes(2);
    expect(exists).toHaveBeenCalledWith('driver:d1:heartbeat');
  });

  it('extends the lifetime when another heartbeat arrives', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-22T10:00:00.000Z'));

    let expiresAt = 0;
    const client = {
      set: vi.fn(
        (
          _key: string,
          _value: string,
          options: { expiration: { type: 'EX'; value: number } },
        ) => {
          expiresAt = Date.now() + options.expiration.value * 1_000;
          return 'OK';
        },
      ),
      exists: vi.fn(() => (Date.now() < expiresAt ? 1 : 0)),
    };
    const service = new DriverPresenceService({ client } as unknown as RedisService);

    await service.heartbeat('d1');
    await vi.advanceTimersByTimeAsync(10_000);
    await service.heartbeat('d1');
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(service.isAlive('d1')).resolves.toBe(true);

    await vi.advanceTimersByTimeAsync(5_000);

    await expect(service.isAlive('d1')).resolves.toBe(false);
    expect(client.set).toHaveBeenCalledTimes(2);
  });
});
