import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import type { RedisProbe } from '../redis/redis.service';

@Injectable()
export class OrdersService {
  constructor(
    readonly database: DatabaseService,
    readonly redis: RedisService,
  ) {}

  async probeRedis(): Promise<RedisProbe> {
    return this.redis.writeProbe('orders');
  }
}
