import type { z } from 'zod';
import type { orderHashSchema, orderSeedSchema, orderStatusSchema } from './orders.schemas';

export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderSeed = z.infer<typeof orderSeedSchema>;
export type Order = z.infer<typeof orderHashSchema> & { id: string };
