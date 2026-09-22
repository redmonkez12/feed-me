import { describe, expect, it } from 'vitest';
import { createRedisDouble } from '../../test/doubles/redis-double';
import { RedisService } from '../redis/redis.service';
import { OrderQueueService } from './order-queue.service';

describe('OrderQueueService.enqueueOrder', () => {
  it('appends order IDs to the queue and returns its new length', async () => {
    const { client, lists } = createRedisDouble();
    const service = new OrderQueueService({ client } as unknown as RedisService);

    await expect(service.enqueueOrder('o1001')).resolves.toBe(1);
    await expect(service.enqueueOrder('o1002')).resolves.toBe(2);
    await expect(service.enqueueOrder('o1003')).resolves.toBe(3);

    expect(lists.get('queue:orders')).toEqual(['o1001', 'o1002', 'o1003']);
    expect(client.rPush).toHaveBeenNthCalledWith(1, 'queue:orders', 'o1001');
  });
});
