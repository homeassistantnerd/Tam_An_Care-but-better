import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import {
  ActivityRehabilitationAuthorizationService,
} from './activity-rehabilitation-authorization.service';

import {
  ActivityRehabilitationController,
} from './activity-rehabilitation.controller';

import {
  ActivityRehabilitationService,
} from './activity-rehabilitation.service';
import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';

@Module({
  imports: [ResidentAccessScopeModule, DatabaseModule],
  controllers: [ActivityRehabilitationController],
  providers: [
    ActivityRehabilitationService,
    ActivityRehabilitationAuthorizationService,
  ],
  exports: [ActivityRehabilitationService],
})
export class ActivityRehabilitationModule {}
