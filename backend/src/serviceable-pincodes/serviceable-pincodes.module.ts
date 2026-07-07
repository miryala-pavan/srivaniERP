import { Module } from '@nestjs/common';
import { ServiceablePincodesService } from './serviceable-pincodes.service';
import { ServiceablePincodesController } from './serviceable-pincodes.controller';

@Module({
  providers:   [ServiceablePincodesService],
  controllers: [ServiceablePincodesController],
  exports:     [ServiceablePincodesService],
})
export class ServiceablePincodesModule {}
