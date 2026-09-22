import { describe, expect, it, vi } from 'vitest';
import { createRedisDouble } from '../../test/doubles/redis-double';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { MenusService } from './menus.service';
import type { Menu } from './menus.types';

describe('MenusService.seedMenuJson', () => {
  it('stores a validated menu as a Redis JSON root document', async () => {
    const set = vi.fn().mockResolvedValue('OK');
    const redis = { client: { json: { set } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);
    const menu: Menu = {
      id: 'r1',
      name: 'Brno Kitchen',
      longitude: 16.6068,
      latitude: 49.1951,
      dishes: [
        {
          id: 'dish1',
          name: 'Margherita',
          priceCents: 18_900,
          vegetarian: true,
          spicy: false,
          available: true,
          options: { extraCheese: true },
        },
      ],
    };

    await expect(service.seedMenuJson(menu)).resolves.toEqual(menu);
    expect(set).toHaveBeenCalledWith('menu:r1', '$', menu);
  });

  it('rejects an invalid menu before writing to Redis', async () => {
    const set = vi.fn().mockResolvedValue('OK');
    const redis = { client: { json: { set } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(
      service.seedMenuJson({
        id: 'r1',
        name: 'Invalid menu',
        longitude: 16.6068,
        latitude: 49.1951,
        dishes: [
          {
            id: 'dish1',
            name: 'Invalid dish',
            priceCents: -1,
            vegetarian: true,
            spicy: false,
            available: true,
            options: {},
          },
        ],
      }),
    ).rejects.toThrow();
    expect(set).not.toHaveBeenCalled();
  });
});

describe('MenusService.getMenuJson', () => {
  it('returns a typed menu stored as Redis JSON', async () => {
    const menu: Menu = {
      id: 'r1',
      name: 'Brno Kitchen',
      longitude: 16.6068,
      latitude: 49.1951,
      dishes: [
        {
          id: 'dish1',
          name: 'Margherita',
          priceCents: 18_900,
          vegetarian: true,
          spicy: false,
          available: true,
          options: { extraCheese: true },
        },
      ],
    };
    const get = vi.fn().mockResolvedValue(menu);
    const redis = { client: { json: { get } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.getMenuJson('r1')).resolves.toEqual(menu);
    expect(get).toHaveBeenCalledWith('menu:r1');
  });

  it('returns null when the Redis JSON key does not exist', async () => {
    const get = vi.fn().mockResolvedValue(null);
    const redis = { client: { json: { get } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.getMenuJson('missing')).resolves.toBeNull();
    expect(get).toHaveBeenCalledWith('menu:missing');
  });
});

describe('MenusService.getDishFromMenuJson', () => {
  it('selects and returns a dish by its ID through JSONPath', async () => {
    const dish = {
      id: 'dish2',
      name: 'Chilli Chicken',
      priceCents: 22_900,
      vegetarian: false,
      spicy: true,
      available: true,
      options: { rice: true },
    };
    const get = vi.fn().mockResolvedValue([dish]);
    const redis = { client: { json: { get } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.getDishFromMenuJson('r1', 'dish2')).resolves.toEqual(dish);
    expect(get).toHaveBeenCalledWith('menu:r1', {
      path: '$.dishes[?(@.id == "dish2")]',
    });
  });

  it.each([null, []])('returns null when RedisJSON returns %j', async (result) => {
    const get = vi.fn().mockResolvedValue(result);
    const redis = { client: { json: { get } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.getDishFromMenuJson('r1', 'missing')).resolves.toBeNull();
  });

  it('rejects duplicate dish IDs instead of returning an arbitrary match', async () => {
    const duplicate = {
      id: 'dish1',
      name: 'Margherita',
      priceCents: 18_900,
      vegetarian: true,
      spicy: false,
      available: true,
      options: { extraCheese: true },
    };
    const get = vi.fn().mockResolvedValue([duplicate, duplicate]);
    const redis = { client: { json: { get } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.getDishFromMenuJson('r1', 'dish1')).rejects.toThrow(
      'Dish ID dish1 is not unique in menu r1',
    );
  });
});

describe('MenusService.setDishAvailabilityInJson', () => {
  it('updates only the availability of the dish selected by ID', async () => {
    const dish = {
      id: 'dish1',
      name: 'Margherita',
      priceCents: 18_900,
      vegetarian: true,
      spicy: false,
      available: true,
      options: { extraCheese: true },
    };
    const get = vi.fn().mockResolvedValue([dish]);
    const set = vi.fn().mockResolvedValue('OK');
    const redis = { client: { json: { get, set } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.setDishAvailabilityInJson('r1', 'dish1', false)).resolves.toEqual({
      ...dish,
      available: false,
    });
    expect(set).toHaveBeenCalledWith('menu:r1', '$.dishes[?(@.id == "dish1")].available', false);
  });

  it('returns null without writing when the dish does not exist', async () => {
    const get = vi.fn().mockResolvedValue([]);
    const set = vi.fn();
    const redis = { client: { json: { get, set } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.setDishAvailabilityInJson('r1', 'missing', false)).resolves.toBeNull();
    expect(set).not.toHaveBeenCalled();
  });

  it('throws when Redis does not confirm the update', async () => {
    const dish = {
      id: 'dish1',
      name: 'Margherita',
      priceCents: 18_900,
      vegetarian: true,
      spicy: false,
      available: true,
      options: { extraCheese: true },
    };
    const get = vi.fn().mockResolvedValue([dish]);
    const set = vi.fn().mockResolvedValue(null);
    const redis = { client: { json: { get, set } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.setDishAvailabilityInJson('r1', 'dish1', false)).rejects.toThrow(
      'Availability of dish dish1 in menu r1 could not be updated',
    );
  });
});

describe('MenusService.incrementDishPriceInJson', () => {
  const dish = {
    id: 'dish1',
    name: 'Margherita',
    priceCents: 18_900,
    vegetarian: true,
    spicy: false,
    available: true,
    options: { extraCheese: true },
  };

  it('atomically increments the selected dish price and returns the Redis result', async () => {
    const get = vi.fn().mockResolvedValue([dish]);
    const numIncrBy = vi.fn().mockResolvedValue([19_100]);
    const redis = { client: { json: { get, numIncrBy } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.incrementDishPriceInJson('r1', 'dish1', 100)).resolves.toEqual({
      ...dish,
      priceCents: 19_100,
    });
    expect(numIncrBy).toHaveBeenCalledWith(
      'menu:r1',
      '$.dishes[?(@.id == "dish1")].priceCents',
      100,
    );
  });

  it('returns null without incrementing when the dish does not exist', async () => {
    const get = vi.fn().mockResolvedValue([]);
    const numIncrBy = vi.fn();
    const redis = { client: { json: { get, numIncrBy } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.incrementDishPriceInJson('r1', 'missing', 100)).resolves.toBeNull();
    expect(numIncrBy).not.toHaveBeenCalled();
  });

  it('rejects a change that would make the price negative', async () => {
    const get = vi.fn().mockResolvedValue([dish]);
    const numIncrBy = vi.fn();
    const redis = { client: { json: { get, numIncrBy } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.incrementDishPriceInJson('r1', 'dish1', -20_000)).rejects.toThrow(
      'Dish price must be a non-negative safe integer',
    );
    expect(numIncrBy).not.toHaveBeenCalled();
  });

  it('rejects a fractional cents delta', async () => {
    const get = vi.fn();
    const numIncrBy = vi.fn();
    const redis = { client: { json: { get, numIncrBy } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.incrementDishPriceInJson('r1', 'dish1', 0.5)).rejects.toThrow(
      'Dish price delta must be a safe integer',
    );
    expect(get).not.toHaveBeenCalled();
    expect(numIncrBy).not.toHaveBeenCalled();
  });
});

describe('MenusService.setDishOptionInJson', () => {
  const dish = {
    id: 'dish1',
    name: 'Margherita',
    priceCents: 18_900,
    vegetarian: true,
    spicy: false,
    available: true,
    options: { extraCheese: true },
  };

  it('updates an option without replacing the remaining options', async () => {
    const get = vi.fn().mockResolvedValue([dish]);
    const merge = vi.fn().mockResolvedValue('OK');
    const redis = { client: { json: { get, merge } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.setDishOptionInJson('r1', 'dish1', 'extraCheese', false)).resolves.toEqual(
      {
        ...dish,
        options: { extraCheese: false },
      },
    );
    expect(merge).toHaveBeenCalledWith('menu:r1', '$.dishes[?(@.id == "dish1")].options', {
      extraCheese: false,
    });
  });

  it('adds a new option while preserving existing options', async () => {
    const get = vi.fn().mockResolvedValue([dish]);
    const merge = vi.fn().mockResolvedValue('OK');
    const redis = { client: { json: { get, merge } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.setDishOptionInJson('r1', 'dish1', 'note', 'no onions')).resolves.toEqual({
      ...dish,
      options: {
        extraCheese: true,
        note: 'no onions',
      },
    });
    expect(merge).toHaveBeenCalledWith('menu:r1', '$.dishes[?(@.id == "dish1")].options', {
      note: 'no onions',
    });
  });

  it('returns null without writing when the dish does not exist', async () => {
    const get = vi.fn().mockResolvedValue([]);
    const merge = vi.fn();
    const redis = { client: { json: { get, merge } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(
      service.setDishOptionInJson('r1', 'missing', 'extraCheese', false),
    ).resolves.toBeNull();
    expect(merge).not.toHaveBeenCalled();
  });

  it('rejects an empty option name before reading or writing Redis', async () => {
    const get = vi.fn();
    const merge = vi.fn();
    const redis = { client: { json: { get, merge } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.setDishOptionInJson('r1', 'dish1', '', true)).rejects.toThrow(
      'Dish option name cannot be empty',
    );
    expect(get).not.toHaveBeenCalled();
    expect(merge).not.toHaveBeenCalled();
  });
});

describe('MenusService.appendDishToMenuJson', () => {
  const existingDish = {
    id: 'dish1',
    name: 'Margherita',
    priceCents: 18_900,
    vegetarian: true,
    spicy: false,
    available: true,
    options: { extraCheese: true },
  };
  const newDish = {
    id: 'dish2',
    name: 'Chilli Chicken',
    priceCents: 22_900,
    vegetarian: false,
    spicy: true,
    available: true,
    options: { rice: true },
  };
  const menu: Menu = {
    id: 'r1',
    name: 'Brno Kitchen',
    longitude: 16.6068,
    latitude: 49.1951,
    dishes: [existingDish],
  };

  it('appends a validated dish and returns the new dishes length', async () => {
    const get = vi.fn().mockResolvedValue(menu);
    const arrAppend = vi.fn().mockResolvedValue([2]);
    const redis = { client: { json: { get, arrAppend } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.appendDishToMenuJson('r1', newDish)).resolves.toBe(2);
    expect(arrAppend).toHaveBeenCalledWith('menu:r1', '$.dishes', newDish);
  });

  it('returns null without appending when the menu does not exist', async () => {
    const get = vi.fn().mockResolvedValue(null);
    const arrAppend = vi.fn();
    const redis = { client: { json: { get, arrAppend } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.appendDishToMenuJson('missing', newDish)).resolves.toBeNull();
    expect(arrAppend).not.toHaveBeenCalled();
  });

  it('rejects a duplicate dish ID without appending', async () => {
    const get = vi.fn().mockResolvedValue(menu);
    const arrAppend = vi.fn();
    const redis = { client: { json: { get, arrAppend } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.appendDishToMenuJson('r1', existingDish)).rejects.toThrow(
      'Dish ID dish1 already exists in menu r1',
    );
    expect(arrAppend).not.toHaveBeenCalled();
  });

  it('rejects an invalid dish before reading or writing Redis', async () => {
    const get = vi.fn();
    const arrAppend = vi.fn();
    const redis = { client: { json: { get, arrAppend } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(
      service.appendDishToMenuJson('r1', {
        ...newDish,
        priceCents: -1,
      }),
    ).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
    expect(arrAppend).not.toHaveBeenCalled();
  });
});

describe('MenusService.deleteDishFromMenuJson', () => {
  const dish = {
    id: 'dish1',
    name: 'Margherita',
    priceCents: 18_900,
    vegetarian: true,
    spicy: false,
    available: true,
    options: { extraCheese: true },
  };

  it('deletes only the dish selected by ID', async () => {
    const get = vi.fn().mockResolvedValue([dish]);
    const del = vi.fn().mockResolvedValue(1);
    const redis = { client: { json: { get, del } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.deleteDishFromMenuJson('r1', 'dish1')).resolves.toBe(true);
    expect(del).toHaveBeenCalledWith('menu:r1', {
      path: '$.dishes[?(@.id == "dish1")]',
    });
  });

  it('returns false without deleting when the dish does not exist', async () => {
    const get = vi.fn().mockResolvedValue([]);
    const del = vi.fn();
    const redis = { client: { json: { get, del } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.deleteDishFromMenuJson('r1', 'missing')).resolves.toBe(false);
    expect(del).not.toHaveBeenCalled();
  });

  it('returns false when the dish disappears before JSON.DEL runs', async () => {
    const get = vi.fn().mockResolvedValue([dish]);
    const del = vi.fn().mockResolvedValue(0);
    const redis = { client: { json: { get, del } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.deleteDishFromMenuJson('r1', 'dish1')).resolves.toBe(false);
  });

  it('rejects an unexpected multi-delete result', async () => {
    const get = vi.fn().mockResolvedValue([dish]);
    const del = vi.fn().mockResolvedValue(2);
    const redis = { client: { json: { get, del } } } as unknown as RedisService;
    const service = new MenusService({} as DatabaseService, redis);

    await expect(service.deleteDishFromMenuJson('r1', 'dish1')).rejects.toThrow(
      'Dish ID dish1 was deleted more than once from menu r1',
    );
  });
});

describe('MenusService dish Hash representation', () => {
  const dish = {
    id: 'dish1',
    name: 'Margherita',
    priceCents: 18_900,
    vegetarian: true,
    spicy: false,
    available: true,
    options: { extraCheese: true },
  };

  const createHashService = () => {
    const redisDouble = createRedisDouble();
    const redis = { client: redisDouble.client } as unknown as RedisService;

    return {
      ...redisDouble,
      service: new MenusService({} as DatabaseService, redis),
    };
  };

  it('seeds scalar fields and serializes nested options', async () => {
    const { hashes, service } = createHashService();

    await expect(service.seedDishHash(dish)).resolves.toEqual(dish);
    expect(hashes.get('dish:dish1')).toEqual({
      name: 'Margherita',
      priceCents: '18900',
      vegetarian: 'true',
      spicy: 'false',
      available: 'true',
      options: '{"extraCheese":true}',
    });
  });

  it('reads HGETALL strings as a typed dish', async () => {
    const { hashes, service } = createHashService();
    hashes.set('dish:dish1', {
      name: 'Margherita',
      priceCents: '18900',
      vegetarian: 'true',
      spicy: 'false',
      available: 'true',
      options: '{"extraCheese":true}',
    });

    await expect(service.getDishHash('dish1')).resolves.toEqual(dish);
    await expect(service.getDishHash('missing')).resolves.toBeNull();
  });

  it('reads only the price field through HGET', async () => {
    const { hashes, service } = createHashService();
    hashes.set('dish:dish1', {
      priceCents: '18900',
    });

    await expect(service.getDishPriceFromHash('dish1')).resolves.toBe(18_900);
    await expect(service.getDishPriceFromHash('missing')).resolves.toBeNull();
  });

  it('updates only priceCents and preserves every other Hash field', async () => {
    const { hashes, service } = createHashService();
    await service.seedDishHash(dish);

    await expect(service.setDishPriceInHash('dish1', 19_900)).resolves.toEqual({
      ...dish,
      priceCents: 19_900,
    });
    expect(hashes.get('dish:dish1')).toEqual({
      name: 'Margherita',
      priceCents: '19900',
      vegetarian: 'true',
      spicy: 'false',
      available: 'true',
      options: '{"extraCheese":true}',
    });
  });

  it('does not create a partial Hash when updating a missing dish', async () => {
    const { hashes, service } = createHashService();

    await expect(service.setDishPriceInHash('missing', 19_900)).resolves.toBeNull();
    expect(hashes.has('dish:missing')).toBe(false);
  });
});
