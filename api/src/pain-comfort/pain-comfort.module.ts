import { Module } from '@nestjs/common';
import { PainComfortController } from './pain-comfort.controller';
import { PainComfortService } from './pain-comfort.service';
import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';

@Module({
  imports: [ResidentAccessScopeModule],
  controllers: [PainComfortController],
  providers: [PainComfortService],
})
export class PainComfortModule {}
