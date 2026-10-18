import { Module } from '@nestjs/common';
import { InfectionControlController } from './infection-control.controller';
import { InfectionControlService } from './infection-control.service';
import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';

@Module({
  imports: [ResidentAccessScopeModule],
  controllers: [InfectionControlController],
  providers: [InfectionControlService],
})
export class InfectionControlModule {}
