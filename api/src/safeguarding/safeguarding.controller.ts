import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { SafeguardingService } from './safeguarding.service';
import { ResidentAccessScopeService } from '../resident-access-scope/resident-access-scope.service';

@Controller('api/safeguarding')
export class SafeguardingController {
  constructor(
    private readonly service: SafeguardingService,
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
    return this.service.execute(residentId, { ...body, actorId, actorRole });
  }
}
