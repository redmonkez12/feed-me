import { Module } from '@nestjs/common';
import { DriverLocationService } from './driver-location.service';
import { DriverPresenceService } from './driver-presence.service';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

@Module({
  controllers: [DriversController],
  providers: [DriversService, DriverPresenceService, DriverLocationService],
  exports: [DriversService, DriverPresenceService, DriverLocationService],
})
export class DriversModule {}
