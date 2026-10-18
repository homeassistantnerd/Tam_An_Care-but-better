import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { PersonalCareService } from './personal-care.service';
import { ResidentAccessScopeService } from '../resident-access-scope/resident-access-scope.service';

@Controller('api/personal-care')
export class PersonalCareController {
  constructor(
    private readonly service: PersonalCareService,
    private readonly residentScope: ResidentAccessScopeService,
  ) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @Post(':residentId/execute')
  async execute(
    @Param('residentId') residentId: string,
    @Body() body: any,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    if (!actorId || !actorRole) throw new UnauthorizedException('Actor context is required');
    await this.residentScope.assertClinicalWriteAccess(actorId, actorRole, residentId);
    body = { ...body, actorId, actorRole };
    return this.service.execute(residentId, body);
  }
}
