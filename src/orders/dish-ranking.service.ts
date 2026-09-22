import { Injectable } from '@nestjs/common';
import { rankDishesKey } from '../common/keys';
import { RedisService } from '../redis/redis.service';
import { dishRankIncrementSchema } from './dish-ranking.schema';

@Injectable()
export class DishRankingService {
  constructor(readonly redis: RedisService) {}

  async incrementDishRank(dishId: string, quantity: number): Promise<number> {
    dishRankIncrementSchema.parse({ dishId, quantity });
    return this.redis.client.zIncrBy(rankDishesKey(), quantity, dishId);
  }
}
