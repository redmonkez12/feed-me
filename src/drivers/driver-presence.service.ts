import { Injectable } from '@nestjs/common';
import { driverKey, driverOnlineKey } from '../common/keys';
import { RedisService } from '../redis/redis.service';

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
}
