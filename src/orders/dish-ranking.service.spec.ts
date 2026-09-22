import { describe, expect, it } from 'vitest';
import { createRedisDouble } from '../../test/doubles/redis-double';
import { RedisService } from '../redis/redis.service';
import { DishRankingService } from './dish-ranking.service';

describe('DishRankingService.incrementDishRank', () => {
  it('increments each dish score by the sold quantity and returns the new score', async () => {
    const { client, sortedSets } = createRedisDouble();
    const service = new DishRankingService({ client } as unknown as RedisService);

    await expect(service.incrementDishRank('dish1', 2)).resolves.toBe(2);
    await expect(service.incrementDishRank('dish2', 1)).resolves.toBe(1);
    await expect(service.incrementDishRank('dish1', 1)).resolves.toBe(3);

    expect(sortedSets.get('rank:dishes')).toEqual(
      new Map([
        ['dish1', 3],
        ['dish2', 1],
      ]),
    );
  });

  it('rejects a non-positive or fractional quantity', async () => {
    const { client } = createRedisDouble();
    const service = new DishRankingService({ client } as unknown as RedisService);

    await expect(service.incrementDishRank('dish1', 0)).rejects.toThrow();
    await expect(service.incrementDishRank('dish1', 1.5)).rejects.toThrow();
    expect(client.zIncrBy).not.toHaveBeenCalled();
  });
});
