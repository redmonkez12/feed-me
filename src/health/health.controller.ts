import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';

type HealthResponse = {
  status: 'ok';
  services: {
    postgres: 'up';
    redis: 'up';
  };
};

@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    try {
      await Promise.all([this.database.ping(), this.redis.ping()]);

      return {
        status: 'ok',
        services: {
          postgres: 'up',
          redis: 'up',
        },
      };
    } catch {
      throw new ServiceUnavailableException('A required dependency is unavailable');
    }
  }
}
