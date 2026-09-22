import { vi } from 'vitest';

export type GeoPosition = {
  longitude: number;
  latitude: number;
  member: string;
};

type GeoAddOptions = {
  CH?: boolean;
};

export function createRedisDouble() {
  const hashes = new Map<string, Record<string, string>>();
  const lists = new Map<string, string[]>();
  const sets = new Map<string, Set<string>>();
  const sortedSets = new Map<string, Map<string, number>>();
  const positions = new Map<string, GeoPosition>();

  const keyExists = (key: string): boolean =>
    hashes.has(key) ||
    lists.has(key) ||
    sets.has(key) ||
    sortedSets.has(key) ||
    [...positions.keys()].some((positionKey) => positionKey.startsWith(`${key}:`));

  const client = {
    hSet: vi.fn((key: string, fields: Record<string, string | number>) => {
      const hash = hashes.get(key) ?? {};

      for (const [field, value] of Object.entries(fields)) {
        hash[field] = String(value);
      }

      hashes.set(key, hash);
      return Promise.resolve(Object.keys(fields).length);
    }),
    hSetNX: vi.fn((key: string, field: string, value: string) => {
      const hash = hashes.get(key) ?? {};

      if (field in hash) {
        return Promise.resolve(0);
      }

      hash[field] = value;
      hashes.set(key, hash);
      return Promise.resolve(1);
    }),
    hGetAll: vi.fn((key: string) => Promise.resolve({ ...(hashes.get(key) ?? {}) })),
    hGet: vi.fn((key: string, field: string) => Promise.resolve(hashes.get(key)?.[field] ?? null)),
    hExists: vi.fn((key: string, field: string) =>
      Promise.resolve(field in (hashes.get(key) ?? {}) ? 1 : 0),
    ),
    hDel: vi.fn((key: string, field: string) => {
      const hash = hashes.get(key);

      if (hash === undefined || !(field in hash)) {
        return Promise.resolve(0);
      }

      delete hash[field];

      if (Object.keys(hash).length === 0) {
        hashes.delete(key);
      }

      return Promise.resolve(1);
    }),
    eval: vi.fn((_script: string, options: { keys: string[]; arguments: string[] }) => {
      const hash = hashes.get(options.keys[0]);

      if (hash === undefined) {
        return Promise.resolve(null);
      }

      const field = options.arguments[0];
      const currentValue = Number(hash[field] ?? '0');

      if (!Number.isInteger(currentValue)) {
        return Promise.reject(new Error('hash value is not an integer'));
      }

      const nextValue = currentValue + 1;
      hash[field] = String(nextValue);
      return Promise.resolve(nextValue);
    }),
    exists: vi.fn((key: string) => Promise.resolve(keyExists(key) ? 1 : 0)),
    sAdd: vi.fn((key: string, member: string) => {
      const members = sets.get(key) ?? new Set<string>();
      const added = !members.has(member);
      members.add(member);
      sets.set(key, members);
      return Promise.resolve(added ? 1 : 0);
    }),
    sRem: vi.fn((key: string, member: string) => {
      const members = sets.get(key);
      const removed = members?.delete(member) ?? false;

      if (members?.size === 0) {
        sets.delete(key);
      }

      return Promise.resolve(removed ? 1 : 0);
    }),
    rPush: vi.fn((key: string, value: string) => {
      const list = lists.get(key) ?? [];
      list.push(value);
      lists.set(key, list);
      return Promise.resolve(list.length);
    }),
    zIncrBy: vi.fn((key: string, increment: number, member: string) => {
      const sortedSet = sortedSets.get(key) ?? new Map<string, number>();
      const nextScore = (sortedSet.get(member) ?? 0) + increment;
      sortedSet.set(member, nextScore);
      sortedSets.set(key, sortedSet);
      return Promise.resolve(nextScore);
    }),
    geoAdd: vi.fn((key: string, position: GeoPosition, options?: GeoAddOptions) => {
      const positionKey = `${key}:${position.member}`;
      const previous = positions.get(positionKey);
      const changed =
        previous === undefined ||
        previous.longitude !== position.longitude ||
        previous.latitude !== position.latitude;

      positions.set(positionKey, position);
      return Promise.resolve(options?.CH ? (changed ? 1 : 0) : previous === undefined ? 1 : 0);
    }),
    type: vi.fn((key: string) => {
      const type = hashes.has(key)
        ? 'hash'
        : lists.has(key)
          ? 'list'
          : sets.has(key)
            ? 'set'
            : sortedSets.has(key) ||
                [...positions.keys()].some((positionKey) => positionKey.startsWith(`${key}:`))
              ? 'zset'
              : 'none';

      return Promise.resolve(type);
    }),
  };

  return { client, hashes, lists, sets, sortedSets, positions };
}
