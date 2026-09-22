import { Controller, Post } from '@nestjs/common';
import { DriversService } from './drivers.service';
import type { RedisProbe } from '../redis/redis.service';

@Controller('drivers')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Post('redis-probe')
  async probeRedis(): Promise<RedisProbe> {
    return this.drivers.probeRedis();
  }
}
