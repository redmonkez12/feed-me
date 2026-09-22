import { z } from 'zod';
import type { Dish, DishHash, DishOptionValue, Menu } from './menus.types';

export const dishOptionValueSchema: z.ZodType<DishOptionValue> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
]);

const dishOptionsSchema: z.ZodType<Dish['options']> = z.record(z.string(), dishOptionValueSchema);
export const dishPriceCentsSchema: z.ZodType<number, number> = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

export const dishSchema: z.ZodType<Dish> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceCents: dishPriceCentsSchema,
  vegetarian: z.boolean(),
  spicy: z.boolean(),
  available: z.boolean(),
  options: dishOptionsSchema,
});

const hashBooleanSchema = z.stringbool({ truthy: ['true'], falsy: ['false'] });
const hashOptionsSchema = z
  .string()
  .transform((value, context): unknown => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'Dish options must contain valid JSON',
      });
      return z.NEVER;
    }
  })
  .pipe(dishOptionsSchema);

export const dishHashSchema: z.ZodType<DishHash> = z.object({
  name: z.string().min(1),
  priceCents: z.coerce.number().pipe(dishPriceCentsSchema),
  vegetarian: hashBooleanSchema,
  spicy: hashBooleanSchema,
  available: hashBooleanSchema,
  options: hashOptionsSchema,
});

export const dishHashPriceSchema: z.ZodType<number> = z.coerce.number().pipe(dishPriceCentsSchema);

export const menuSchema: z.ZodType<Menu> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  longitude: z.number(),
  latitude: z.number(),
  dishes: z.array(dishSchema),
});
