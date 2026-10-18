import { Module } from '@nestjs/common';
import { OperationalWorkModule } from '../operational-work/operational-work.module';
import { PersonalCareController } from './personal-care.controller';
import { PersonalCareService } from './personal-care.service';
import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';

@Module({
  imports: [ResidentAccessScopeModule, OperationalWorkModule],
  controllers: [PersonalCareController],
  providers: [PersonalCareService],
})
export class PersonalCareModule {}
