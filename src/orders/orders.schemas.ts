import { z } from 'zod';
import { ORDER_STATUSES } from './orders.constants';

export const orderStatusSchema = z.enum(ORDER_STATUSES);

export const orderHashSchema = z.object({
  customerId: z.string().min(1),
  restaurantId: z.string().min(1),
  status: orderStatusSchema,
  dueAtMs: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  createdAt: z.iso.datetime().transform((value) => new Date(value)),
});

export const orderSeedSchema = z.object({
  id: z.string().min(1),
  restaurantId: z.string().min(1),
  customerId: z.string().min(1),
  status: orderStatusSchema,
  dueInSeconds: z.number().int().nonnegative(),
});
