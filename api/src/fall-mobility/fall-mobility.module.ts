import { Module } from '@nestjs/common';
import { FallMobilityController } from './fall-mobility.controller';
import { FallMobilityService } from './fall-mobility.service';
import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';

@Module({
  imports: [ResidentAccessScopeModule],
  controllers: [FallMobilityController],
  providers: [FallMobilityService],
})
export class FallMobilityModule {}
