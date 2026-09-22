import { z } from 'zod';

export const driverLocationSchema = z.object({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-85.05112878).max(85.05112878),
});
