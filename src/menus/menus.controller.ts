import { Controller, Post } from '@nestjs/common';
import { MenusService } from './menus.service';
import type { RedisProbe } from '../redis/redis.service';

@Controller('menus')
export class MenusController {
  constructor(private readonly menus: MenusService) {}

  @Post('redis-probe')
  async probeRedis(): Promise<RedisProbe> {
    return this.menus.probeRedis();
  }
}
