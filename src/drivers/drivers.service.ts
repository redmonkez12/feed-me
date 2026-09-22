import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { driverKey } from '../common/keys';
import { RedisService } from '../redis/redis.service';
import type { RedisProbe } from '../redis/redis.service';
import { DriverLocationService } from './driver-location.service';
import { DriverPresenceService } from './driver-presence.service';
import { driverHashSchema, driverSeedSchema } from './drivers.schema';
import type { Driver, DriverSeed } from './drivers.types';

@Injectable()
export class DriversService {
  constructor(
    readonly database: DatabaseService,
    readonly redis: RedisService,
    readonly presence: DriverPresenceService,
    readonly location: DriverLocationService,
  ) {}

  async seedDriver(driver: DriverSeed, now = new Date()): Promise<Driver> {
    const input = driverSeedSchema.parse(driver);
    const key = driverKey(input.id);

    await this.redis.client.hSet(key, {
      name: input.name,
      busy: String(input.busy),
    });

    await Promise.all([
      this.redis.client.hSetNX(key, 'createdAt', now.toISOString()),
      this.redis.client.hSetNX(key, 'completedDeliveries', '0'),
    ]);

    await Promise.all([
      this.presence.setOnline(input.id, input.online),
      this.location.updateLocation(input.id, input.longitude, input.latitude),
    ]);

    const seededDriver = await this.getDriver(input.id);

    if (seededDriver === null) {
      throw new Error(`Driver ${input.id} disappeared after seeding`);
    }

    return seededDriver;
  }

  async getDriver(id: string): Promise<Driver | null> {
    const key = driverKey(id);
    const hash = await this.redis.client.hGetAll(key);

    if (Object.keys(hash).length === 0) {
      return null;
    }

    return {
      id,
      ...driverHashSchema.parse(hash),
    };
  }

  async incrementCompletedDeliveries(id: string): Promise<number | null> {
    const result = await this.redis.client.eval(
      `
      if redis.call('EXISTS', KEYS[1]) == 0 then
        return nil
      end

      return redis.call('HINCRBY', KEYS[1], ARGV[1], 1)
    `,
      {
        keys: [driverKey(id)],
        arguments: ['completedDeliveries'],
      },
    );

    return result as number | null;
  }

  async probeRedis(): Promise<RedisProbe> {
    return this.redis.writeProbe('drivers');
  }
}
