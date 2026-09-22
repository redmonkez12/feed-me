import { z } from 'zod';
import { driverLocationSchema } from './driver-location.schema';

export const driverHashSchema = z.object({
  name: z.string().min(1),
  busy: z.stringbool({ truthy: ['true'], falsy: ['false'] }),
  completedDeliveries: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  createdAt: z.iso.datetime().transform((value) => new Date(value)),
});

export const driverSeedSchema = driverLocationSchema.extend({
  id: z.string().min(1),
  name: z.string().min(1),
  online: z.boolean(),
  busy: z.boolean(),
});
