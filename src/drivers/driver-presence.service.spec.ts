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
    await expect(service.getOnlineCount()).resolves.toBe(1);
    await expect(service.setOnline('d1', true)).resolves.toBe(false);
    await expect(service.getOnlineCount()).resolves.toBe(1);
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

  it('starts a heartbeat at registration so a driver can become stale without another one', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-22T10:00:00.000Z'));
    const { client, hashes, sortedSets } = createRedisDouble();
    const service = new DriverPresenceService({ client } as unknown as RedisService);
    hashes.set('driver:d1', { name: 'Adam' });

    await service.setOnline('d1', true);
    expect(sortedSets.get('drivers:lastseen')?.get('d1')).toBe(Date.now());
    await expect(service.isActive('d1')).resolves.toBe(true);

    await vi.advanceTimersByTimeAsync(15_000);
    await expect(service.isActive('d1')).resolves.toBe(false);
  });
});

describe('DriverPresenceService.isOnline', () => {
  it('checks membership in the online Set', async () => {
    const sIsMember = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const service = new DriverPresenceService({
      client: { sIsMember },
    } as unknown as RedisService);

    await expect(service.isOnline('d1')).resolves.toBe(true);
    await expect(service.isOnline('d2')).resolves.toBe(false);
    expect(sIsMember).toHaveBeenNthCalledWith(1, 'drivers:online', 'd1');
    expect(sIsMember).toHaveBeenNthCalledWith(2, 'drivers:online', 'd2');
  });
});

describe('DriverPresenceService.getOnlineCount', () => {
  it('returns the Set cardinality', async () => {
    const sCard = vi.fn().mockResolvedValue(2);
    const service = new DriverPresenceService({
      client: { sCard },
    } as unknown as RedisService);

    await expect(service.getOnlineCount()).resolves.toBe(2);
    expect(sCard).toHaveBeenCalledWith('drivers:online');
  });
});

describe('DriverPresenceService heartbeat', () => {
  it('stores the heartbeat TTL and last-seen score in one transaction', async () => {
    const transaction = {
      set: vi.fn().mockReturnThis(),
      zAdd: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(['OK', 1]),
    };
    const multi = vi.fn().mockReturnValue(transaction);
    const service = new DriverPresenceService({
      client: { multi },
    } as unknown as RedisService);

    await service.heartbeat('d1', 1_000);

    expect(multi).toHaveBeenCalledOnce();
    expect(transaction.set).toHaveBeenCalledWith('driver:d1:heartbeat', '1', {
      expiration: { type: 'EX', value: 15 },
    });
    expect(transaction.zAdd).toHaveBeenCalledWith(
      'drivers:lastseen',
      { score: 1_000, value: 'd1' },
      { comparison: 'GT' },
    );
    expect(transaction.exec).toHaveBeenCalledOnce();
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
    const transaction = {
      set: vi.fn(
        (_key: string, _value: string, options: { expiration: { type: 'EX'; value: number } }) => {
          expiresAt = Date.now() + options.expiration.value * 1_000;
          return transaction;
        },
      ),
      zAdd: vi.fn(() => transaction),
      exec: vi.fn().mockResolvedValue(['OK', 1]),
    };
    const client = {
      multi: vi.fn(() => transaction),
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
    expect(transaction.set).toHaveBeenCalledTimes(2);
    expect(transaction.zAdd).toHaveBeenCalledTimes(2);
  });
});

describe('DriverPresenceService.isActive', () => {
  it('requires both online membership and a live heartbeat', async () => {
    const client = {
      sIsMember: vi.fn().mockResolvedValue(1),
      exists: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
    };
    const service = new DriverPresenceService({ client } as unknown as RedisService);

    await expect(service.isActive('d1')).resolves.toBe(true);
    await expect(service.isActive('d1')).resolves.toBe(false);
  });
});

describe('DriverPresenceService.cleanupStaleDrivers', () => {
  it('rechecks each candidate atomically and counts only removed entries', async () => {
    const client = {
      zRangeByScore: vi.fn().mockResolvedValue(['renewed', 'stale']),
      eval: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1),
    };
    const service = new DriverPresenceService({ client } as unknown as RedisService);

    await expect(service.cleanupStaleDrivers(20_000)).resolves.toBe(1);
    expect(client.zRangeByScore).toHaveBeenCalledWith('drivers:lastseen', '-inf', 5_000);
    expect(client.eval).toHaveBeenCalledTimes(2);
    expect(client.eval.mock.calls[0][1]).toEqual({
      keys: ['drivers:lastseen', 'drivers:online', 'geo:drivers'],
      arguments: ['renewed', '5000'],
    });
    expect(client.eval.mock.calls[1][1]).toEqual({
      keys: ['drivers:lastseen', 'drivers:online', 'geo:drivers'],
      arguments: ['stale', '5000'],
    });
  });
});
