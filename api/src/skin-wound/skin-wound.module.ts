import { Module } from '@nestjs/common';
import { SkinWoundController } from './skin-wound.controller';
import { SkinWoundService } from './skin-wound.service';
import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';

@Module({
  imports: [ResidentAccessScopeModule],
  controllers: [SkinWoundController],
  providers: [SkinWoundService],
})
export class SkinWoundModule {}
