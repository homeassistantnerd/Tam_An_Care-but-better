import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { BehavioralCognitiveService } from './behavioral-cognitive.service';
import { ResidentAccessScopeService } from '../resident-access-scope/resident-access-scope.service';

@Controller('api/behavioral-cognitive')
export class BehavioralCognitiveController {
  constructor(
    private readonly service: BehavioralCognitiveService,
    private readonly residentScope: ResidentAccessScopeService,
  ) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @Get('guardian-resident-ids')
  guardianResidentIds(
    @Headers('x-actor-id')
    actorId?: string,

    @Headers('x-actor-role')
    actorRole?: string,
  ) {
    return this.service.listGuardianResidentIds(
      actorId,
      actorRole,
    );
  }

  @Get('psychological-assessments')
  psychologicalAssessments(
    @Headers('x-actor-id')
    actorId?: string,

    @Headers('x-actor-role')
    actorRole?: string,
  ) {
    return this.service.listPsychologicalAssessments(
      actorId,
      actorRole,
    );
  }

  @Get(':residentId/psychological-assessments')
  residentPsychologicalAssessments(
    @Headers('x-actor-id')
    actorId: string | undefined,

    @Headers('x-actor-role')
    actorRole: string | undefined,

    @Param('residentId')
    residentId: string,
  ) {
    return this.service.listPsychologicalAssessments(
      actorId,
      actorRole,
      residentId,
    );
  }

  @Post(':residentId/psychological-assessments')
  async createPsychologicalAssessment(
    @Headers('x-actor-id')
    actorId: string | undefined,

    @Headers('x-actor-role')
    actorRole: string | undefined,

    @Param('residentId')
    residentId: string,

    @Body()
    body: any,
  ) {
    if (!actorId || !actorRole) throw new UnauthorizedException('Actor context is required');
    await this.residentScope.assertClinicalWriteAccess(actorId, actorRole, residentId);
    return this.service.createPsychologicalAssessment(
      residentId,
      {
        ...body,
        actorId,
        actorRole,
      },
    );
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
