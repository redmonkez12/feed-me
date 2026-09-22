import { Injectable } from '@nestjs/common';
import { driverKey, geoDriverKey } from '../common/keys';
import { RedisService } from '../redis/redis.service';
import { driverLocationSchema } from './driver-location.schema';

@Injectable()
export class DriverLocationService {
  constructor(readonly redis: RedisService) {}

  async updateLocation(id: string, longitude: number, latitude: number): Promise<boolean | null> {
    driverLocationSchema.parse({ longitude, latitude });
    const driverExists = await this.redis.client.exists(driverKey(id));

    if (driverExists === 0) {
      return null;
    }

    const changed = await this.redis.client.geoAdd(
      geoDriverKey(),
      { longitude, latitude, member: id },
      { CH: true },
    );

    return changed > 0;
  }
}
