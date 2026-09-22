import { Injectable } from '@nestjs/common';
import { driverHeartbeatKey, driverKey, driverOnlineKey } from '../common/keys';
import { RedisService } from '../redis/redis.service';

const DRIVER_HEARTBEAT_TTL_SECONDS = 15;

@Injectable()
export class DriverPresenceService {
  constructor(readonly redis: RedisService) {}

  async setOnline(id: string, online: boolean): Promise<boolean | null> {
    const driverExists = await this.redis.client.exists(driverKey(id));

    if (driverExists === 0) {
      return null;
    }

    const changed = online
      ? await this.redis.client.sAdd(driverOnlineKey(), id)
      : await this.redis.client.sRem(driverOnlineKey(), id);

    return changed > 0;
  }

  async heartbeat(id: string): Promise<void> {
    await this.redis.client.set(driverHeartbeatKey(id), '1', {
      expiration: {
        type: 'EX',
        value: DRIVER_HEARTBEAT_TTL_SECONDS,
      },
    });
  }

  async isAlive(id: string): Promise<boolean> {
    return (await this.redis.client.exists(driverHeartbeatKey(id))) === 1;
  }
}
