import { Module } from '@nestjs/common';
import { SafeguardingController } from './safeguarding.controller';
import { SafeguardingService } from './safeguarding.service';
import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';

@Module({
  imports: [ResidentAccessScopeModule],
  controllers: [SafeguardingController],
  providers: [SafeguardingService],
})
export class SafeguardingModule {}
