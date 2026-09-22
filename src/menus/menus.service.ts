import { Injectable } from '@nestjs/common';
import { dishKey, menuKey } from '../common/keys';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import type { RedisProbe } from '../redis/redis.service';
import {
  dishHashPriceSchema,
  dishHashSchema,
  dishPriceCentsSchema,
  dishSchema,
  menuSchema,
} from './menus.schemas';
import type { Dish, DishOptionValue, Menu } from './menus.types';

const dishJsonPath = (dishId: string): string => `$.dishes[?(@.id == ${JSON.stringify(dishId)})]`;

@Injectable()
export class MenusService {
  constructor(
    readonly database: DatabaseService,
    readonly redis: RedisService,
  ) {}

  async seedMenuJson(menu: Menu): Promise<Menu> {
    const input = menuSchema.parse(menu);
    const result = await this.redis.client.json.set(menuKey(input.id), '$', input);

    if (result !== 'OK') {
      throw new Error(`Menu ${input.id} could not be stored as Redis JSON`);
    }

    return input;
  }

  async getMenuJson(menuId: string): Promise<Menu | null> {
    const result = await this.redis.client.json.get(menuKey(menuId));

    if (result === null) {
      return null;
    }

    return menuSchema.parse(result);
  }

  async getDishFromMenuJson(restaurantId: string, dishId: string): Promise<Dish | null> {
    const path = dishJsonPath(dishId);
    const result = await this.redis.client.json.get(menuKey(restaurantId), { path });

    if (result === null || (Array.isArray(result) && result.length === 0)) {
      return null;
    }

    if (!Array.isArray(result)) {
      throw new Error(`Expected JSONPath ${path} to return an array`);
    }

    if (result.length > 1) {
      throw new Error(`Dish ID ${dishId} is not unique in menu ${restaurantId}`);
    }

    return dishSchema.parse(result[0]);
  }

  async setDishAvailabilityInJson(
    restaurantId: string,
    dishId: string,
    available: boolean,
  ): Promise<Dish | null> {
    const dish = await this.getDishFromMenuJson(restaurantId, dishId);

    if (dish === null) {
      return null;
    }

    const result = await this.redis.client.json.set(
      menuKey(restaurantId),
      `${dishJsonPath(dishId)}.available`,
      available,
    );

    if (result !== 'OK') {
      throw new Error(
        `Availability of dish ${dishId} in menu ${restaurantId} could not be updated`,
      );
    }

    return {
      ...dish,
      available,
    };
  }

  async incrementDishPriceInJson(
    restaurantId: string,
    dishId: string,
    deltaCents: number,
  ): Promise<Dish | null> {
    if (!Number.isSafeInteger(deltaCents)) {
      throw new Error('Dish price delta must be a safe integer');
    }

    const dish = await this.getDishFromMenuJson(restaurantId, dishId);

    if (dish === null) {
      return null;
    }

    const expectedPrice = dish.priceCents + deltaCents;

    if (!Number.isSafeInteger(expectedPrice) || expectedPrice < 0) {
      throw new Error('Dish price must be a non-negative safe integer');
    }

    const path = `${dishJsonPath(dishId)}.priceCents`;
    const result = await this.redis.client.json.numIncrBy(menuKey(restaurantId), path, deltaCents);

    if (!Array.isArray(result)) {
      throw new Error(`Expected JSONPath ${path} to return an array`);
    }

    if (result.length === 0) {
      return null;
    }

    if (result.length > 1) {
      throw new Error(`Dish ID ${dishId} is not unique in menu ${restaurantId}`);
    }

    const updatedPrice = result[0];

    if (updatedPrice === null || !Number.isSafeInteger(updatedPrice) || updatedPrice < 0) {
      throw new Error(`Redis returned an invalid price for dish ${dishId}`);
    }

    return {
      ...dish,
      priceCents: updatedPrice,
    };
  }

  async setDishOptionInJson(
    restaurantId: string,
    dishId: string,
    option: string,
    value: DishOptionValue,
  ): Promise<Dish | null> {
    if (option.length === 0) {
      throw new Error('Dish option name cannot be empty');
    }

    const dish = await this.getDishFromMenuJson(restaurantId, dishId);

    if (dish === null) {
      return null;
    }

    await this.redis.client.json.merge(menuKey(restaurantId), `${dishJsonPath(dishId)}.options`, {
      [option]: value,
    });

    return {
      ...dish,
      options: {
        ...dish.options,
        [option]: value,
      },
    };
  }

  async appendDishToMenuJson(restaurantId: string, dish: Dish): Promise<number | null> {
    const input = dishSchema.parse(dish);
    const menu = await this.getMenuJson(restaurantId);

    if (menu === null) {
      return null;
    }

    if (menu.dishes.some(({ id }) => id === input.id)) {
      throw new Error(`Dish ID ${input.id} already exists in menu ${restaurantId}`);
    }

    const path = '$.dishes';
    const result = await this.redis.client.json.arrAppend(menuKey(restaurantId), path, input);

    if (!Array.isArray(result)) {
      throw new Error(`Expected JSONPath ${path} to return an array`);
    }

    if (result.length !== 1) {
      throw new Error(`Expected one dishes array in menu ${restaurantId}`);
    }

    const newLength = result[0];

    if (newLength === null || !Number.isSafeInteger(newLength) || newLength < 1) {
      throw new Error(`Redis returned an invalid dishes length for menu ${restaurantId}`);
    }

    return newLength;
  }

  async deleteDishFromMenuJson(restaurantId: string, dishId: string): Promise<boolean> {
    const dish = await this.getDishFromMenuJson(restaurantId, dishId);

    if (dish === null) {
      return false;
    }

    const deleted = await this.redis.client.json.del(menuKey(restaurantId), {
      path: dishJsonPath(dishId),
    });

    if (deleted > 1) {
      throw new Error(`Dish ID ${dishId} was deleted more than once from menu ${restaurantId}`);
    }

    return deleted === 1;
  }

  async seedDishHash(dish: Dish): Promise<Dish> {
    const input = dishSchema.parse(dish);

    await this.redis.client.hSet(dishKey(input.id), {
      name: input.name,
      priceCents: String(input.priceCents),
      vegetarian: String(input.vegetarian),
      spicy: String(input.spicy),
      available: String(input.available),
      options: JSON.stringify(input.options),
    });

    const seededDish = await this.getDishHash(input.id);

    if (seededDish === null) {
      throw new Error(`Dish ${input.id} disappeared after seeding`);
    }

    return seededDish;
  }

  async getDishHash(dishId: string): Promise<Dish | null> {
    const hash = await this.redis.client.hGetAll(dishKey(dishId));

    if (Object.keys(hash).length === 0) {
      return null;
    }

    return {
      id: dishId,
      ...dishHashSchema.parse(hash),
    };
  }

  async getDishPriceFromHash(dishId: string): Promise<number | null> {
    const price = await this.redis.client.hGet(dishKey(dishId), 'priceCents');

    if (price === null) {
      return null;
    }

    return dishHashPriceSchema.parse(price);
  }

  async setDishPriceInHash(dishId: string, priceCents: number): Promise<Dish | null> {
    const nextPrice = dishPriceCentsSchema.parse(priceCents);
    const dish = await this.getDishHash(dishId);

    if (dish === null) {
      return null;
    }

    await this.redis.client.hSet(dishKey(dishId), {
      priceCents: String(nextPrice),
    });

    return {
      ...dish,
      priceCents: nextPrice,
    };
  }

  async probeRedis(): Promise<RedisProbe> {
    return this.redis.writeProbe('menus');
  }
}
