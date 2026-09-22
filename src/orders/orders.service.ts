import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { orderKey } from '../common/keys';
import { RedisService } from '../redis/redis.service';
import type { RedisProbe } from '../redis/redis.service';
import { orderHashSchema, orderSeedSchema, orderStatusSchema } from './orders.schemas';
import type { Order, OrderSeed, OrderStatus } from './orders.types';

@Injectable()
export class OrdersService {
  constructor(
    readonly database: DatabaseService,
    readonly redis: RedisService,
  ) {}

  async getOrder(id: string): Promise<Order | null> {
    const hash = await this.redis.client.hGetAll(orderKey(id));

    if (Object.keys(hash).length === 0) {
      return null;
    }

    return {
      id,
      ...orderHashSchema.parse(hash),
    };
  }

  async getOrderStatus(id: string): Promise<OrderStatus | null> {
    const key = orderKey(id);
    const keyType = await this.redis.client.type(key);

    if (keyType === 'none') {
      return null;
    }

    if (keyType !== 'hash') {
      throw new Error(`Expected ${key} to be a Hash, received ${keyType}`);
    }

    const status = await this.redis.client.hGet(key, 'status');

    if (status === null) {
      throw new Error(`Order ${id} exists, but status field is missing`);
    }

    return orderStatusSchema.parse(status);
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null> {
    const order = await this.getOrder(id);

    if (order === null) {
      return null;
    }

    const nextStatus = orderStatusSchema.parse(status);
    await this.redis.client.hSet(orderKey(id), { status: nextStatus });

    return {
      ...order,
      status: nextStatus,
    };
  }

  async hasOrderField(id: string, field: string): Promise<boolean> {
    const exists = await this.redis.client.hExists(orderKey(id), field);
    return exists === 1;
  }

  async deleteOrderField(id: string, field: string): Promise<boolean> {
    const deletedFields = await this.redis.client.hDel(orderKey(id), field);
    return deletedFields > 0;
  }

  async getOrderKeyType(id: string): Promise<string> {
    return this.redis.client.type(orderKey(id));
  }

  async seedOrder(order: OrderSeed, now = new Date()): Promise<Order> {
    const input = orderSeedSchema.parse(order);
    const key = orderKey(input.id);

    await this.redis.client.hSet(key, {
      customerId: input.customerId,
      restaurantId: input.restaurantId,
      status: input.status,
      dueAtMs: now.getTime() + input.dueInSeconds * 1_000,
    });
    await this.redis.client.hSetNX(key, 'createdAt', now.toISOString());

    const seededOrder = await this.getOrder(input.id);

    if (seededOrder === null) {
      throw new Error(`Order ${input.id} disappeared after seeding`);
    }

    return seededOrder;
  }

  async probeRedis(): Promise<RedisProbe> {
    return this.redis.writeProbe('orders');
  }
}
