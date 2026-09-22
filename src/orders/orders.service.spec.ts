import { describe, expect, it } from 'vitest';
import { createRedisDouble } from '../../test/doubles/redis-double';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { OrdersService } from './orders.service';
import type { OrderSeed } from './orders.types';

function createService(client: ReturnType<typeof createRedisDouble>['client']): OrdersService {
  return new OrdersService({} as DatabaseService, { client } as unknown as RedisService);
}

describe('OrdersService.seedOrder', () => {
  it('creates a flat Hash and preserves createdAt on repeated imports', async () => {
    const { client } = createRedisDouble();
    const service = createService(client);
    const order: OrderSeed = {
      id: 'o1001',
      restaurantId: 'r1',
      customerId: 'u1',
      status: 'created',
      dueInSeconds: 120,
    };
    const firstImport = new Date('2026-09-22T08:00:00.000Z');
    const secondImport = new Date('2026-09-22T09:00:00.000Z');

    const firstResult = await service.seedOrder(order, firstImport);
    const secondResult = await service.seedOrder({ ...order, status: 'preparing' }, secondImport);

    expect(firstResult).toEqual({
      id: 'o1001',
      customerId: 'u1',
      restaurantId: 'r1',
      status: 'created',
      dueAtMs: firstImport.getTime() + 120_000,
      createdAt: firstImport,
    });
    expect(secondResult).toMatchObject({
      id: 'o1001',
      customerId: 'u1',
      status: 'preparing',
      createdAt: firstImport,
    });
    expect(client.hSetNX).toHaveBeenCalledWith(
      'order:o1001',
      'createdAt',
      firstImport.toISOString(),
    );
  });
});

describe('OrdersService.getOrderStatus', () => {
  it('distinguishes a missing Hash from a missing status field', async () => {
    const { client, hashes } = createRedisDouble();
    const service = createService(client);

    hashes.set('order:o1001', { status: 'ready' });
    hashes.set('order:o1002', { customerId: 'u2' });

    await expect(service.getOrderStatus('o1001')).resolves.toBe('ready');
    await expect(service.getOrderStatus('missing')).resolves.toBeNull();
    await expect(service.getOrderStatus('o1002')).rejects.toThrow(
      'Order o1002 exists, but status field is missing',
    );
  });
});

describe('OrdersService.updateOrderStatus', () => {
  it('updates only status and preserves the remaining Hash fields', async () => {
    const { client, hashes } = createRedisDouble();
    const service = createService(client);
    const createdAt = new Date('2026-09-22T08:00:00.000Z');

    hashes.set('order:o1001', {
      customerId: 'u1',
      restaurantId: 'r1',
      status: 'created',
      dueAtMs: String(createdAt.getTime() + 120_000),
      createdAt: createdAt.toISOString(),
    });

    await expect(service.updateOrderStatus('o1001', 'preparing')).resolves.toMatchObject({
      customerId: 'u1',
      status: 'preparing',
    });
    expect(hashes.get('order:o1001')).toMatchObject({
      customerId: 'u1',
      status: 'preparing',
    });
    expect(client.hSet).toHaveBeenCalledWith('order:o1001', { status: 'preparing' });
  });

  it('does not create a partial Hash for a missing order', async () => {
    const { client, hashes } = createRedisDouble();
    const service = createService(client);

    await expect(service.updateOrderStatus('missing', 'preparing')).resolves.toBeNull();
    expect(hashes.has('order:missing')).toBe(false);
    expect(client.hSet).not.toHaveBeenCalled();
  });
});

describe('OrdersService Hash diagnostics', () => {
  it('checks and deletes individual fields without deserializing the whole Hash', async () => {
    const { client, hashes } = createRedisDouble();
    const service = createService(client);

    hashes.set('order:o1001', { customerId: 'u1', status: 'preparing', driverId: 'd1' });

    await expect(service.hasOrderField('o1001', 'driverId')).resolves.toBe(true);
    await expect(service.deleteOrderField('o1001', 'driverId')).resolves.toBe(true);
    await expect(service.hasOrderField('o1001', 'driverId')).resolves.toBe(false);
    expect(hashes.get('order:o1001')).toEqual({ customerId: 'u1', status: 'preparing' });
  });

  it('reports missing fields and missing Hashes through HEXISTS', async () => {
    const { client, hashes } = createRedisDouble();
    const service = createService(client);
    hashes.set('order:o1001', { status: 'preparing' });

    await expect(service.hasOrderField('o1001', 'driverId')).resolves.toBe(false);
    await expect(service.hasOrderField('missing', 'status')).resolves.toBe(false);
  });

  it('deletes from an incomplete Hash without deserializing it', async () => {
    const { client, hashes } = createRedisDouble();
    const service = createService(client);
    hashes.set('order:incomplete', { legacyField: 'value' });

    await expect(service.deleteOrderField('incomplete', 'legacyField')).resolves.toBe(true);
    await expect(service.deleteOrderField('incomplete', 'legacyField')).resolves.toBe(false);
    expect(hashes.has('order:incomplete')).toBe(false);
  });

  it('returns the Redis key type', async () => {
    const { client, hashes } = createRedisDouble();
    const service = createService(client);

    hashes.set('order:o1001', { status: 'created' });

    await expect(service.getOrderKeyType('o1001')).resolves.toBe('hash');
    await expect(service.getOrderKeyType('missing')).resolves.toBe('none');
  });
});
