import { Module } from '@nestjs/common';
import { MedicationSafetyController } from './medication-safety.controller';
import { MedicationSafetyService } from './medication-safety.service';
import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';

@Module({
  imports: [ResidentAccessScopeModule],
  controllers: [MedicationSafetyController],
  providers: [MedicationSafetyService],
})
export class MedicationSafetyModule {}
