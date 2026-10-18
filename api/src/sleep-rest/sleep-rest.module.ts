import { Module } from '@nestjs/common';
import { SleepRestController } from './sleep-rest.controller';
import { SleepRestService } from './sleep-rest.service';
import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';

@Module({
  imports: [ResidentAccessScopeModule],
  controllers: [SleepRestController],
  providers: [SleepRestService],
})
export class SleepRestModule {}
