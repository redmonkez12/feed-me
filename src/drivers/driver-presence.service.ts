import { Injectable } from '@nestjs/common';
import {
  driverHeartbeatKey,
  driverKey,
  driverLastSeenKey,
  driverOnlineKey,
  geoDriverKey,
} from '../common/keys';
import { RedisService } from '../redis/redis.service';

const DRIVER_HEARTBEAT_TTL_SECONDS = 15;
const DRIVER_HEARTBEAT_TTL_MS = DRIVER_HEARTBEAT_TTL_SECONDS * 1_000;

const CLEANUP_STALE_DRIVER = `
  local lastSeen = redis.call('ZSCORE', KEYS[1], ARGV[1])
  if not lastSeen or tonumber(lastSeen) > tonumber(ARGV[2]) then
    return 0
  end

  redis.call('SREM', KEYS[2], ARGV[1])
  redis.call('ZREM', KEYS[1], ARGV[1])
  redis.call('ZREM', KEYS[3], ARGV[1])
  return 1
`;

@Injectable()
export class DriverPresenceService {
  constructor(readonly redis: RedisService) {}

  async setOnline(id: string, online: boolean): Promise<boolean | null> {
    const driverExists = await this.redis.client.exists(driverKey(id));

    if (driverExists === 0) {
      return null;
    }

    if (online) {
      await this.heartbeat(id);
      return (await this.redis.client.sAdd(driverOnlineKey(), id)) > 0;
    }

    return (await this.redis.client.sRem(driverOnlineKey(), id)) > 0;
  }

  async isOnline(id: string): Promise<boolean> {
    return (await this.redis.client.sIsMember(driverOnlineKey(), id)) === 1;
  }

  async getOnlineCount(): Promise<number> {
    return this.redis.client.sCard(driverOnlineKey());
  }

  async heartbeat(id: string, now = Date.now()): Promise<void> {
    await this.redis.client
      .multi()
      .set(driverHeartbeatKey(id), '1', {
        expiration: { type: 'EX', value: DRIVER_HEARTBEAT_TTL_SECONDS },
      })
      .zAdd(driverLastSeenKey(), { score: now, value: id }, { comparison: 'GT' })
      .exec();
  }

  async isAlive(id: string): Promise<boolean> {
    return (await this.redis.client.exists(driverHeartbeatKey(id))) === 1;
  }

  async isActive(id: string): Promise<boolean> {
    return (await this.isOnline(id)) && (await this.isAlive(id));
  }

  async cleanupStaleDrivers(now = Date.now()): Promise<number> {
    const cutoff = now - DRIVER_HEARTBEAT_TTL_MS;
    const staleIds = await this.redis.client.zRangeByScore(driverLastSeenKey(), '-inf', cutoff);

    let removed = 0;

    for (const id of staleIds) {
      removed += (await this.redis.client.eval(CLEANUP_STALE_DRIVER, {
        keys: [driverLastSeenKey(), driverOnlineKey(), geoDriverKey()],
        arguments: [id, String(cutoff)],
      })) as number;
    }

    return removed;
  }
}
