import { z } from 'zod';

export const dishRankIncrementSchema = z.object({
  dishId: z.string().min(1),
  quantity: z.number().int().positive(),
});
