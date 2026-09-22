import type { z } from 'zod';
import type { driverHashSchema, driverSeedSchema } from './drivers.schema';

export type Driver = z.infer<typeof driverHashSchema> & { id: string };
export type DriverSeed = z.infer<typeof driverSeedSchema>;
