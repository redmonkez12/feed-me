import { Injectable } from '@nestjs/common';
import { queueKey } from '../common/keys';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class OrderQueueService {
  constructor(readonly redis: RedisService) {}

  async enqueueOrder(id: string): Promise<number> {
    return this.redis.client.rPush(queueKey(), id);
  }
}
