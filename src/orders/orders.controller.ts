import { Controller, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import type { RedisProbe } from '../redis/redis.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('redis-probe')
  async probeRedis(): Promise<RedisProbe> {
    return this.orders.probeRedis();
  }
}
