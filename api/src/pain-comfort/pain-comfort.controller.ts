import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { PainComfortService } from './pain-comfort.service';

@Controller('api/pain-comfort')
export class PainComfortController {
  constructor(private readonly service: PainComfortService) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @Post(':residentId/execute')
  execute(
    @Param('residentId') residentId: string,
    @Body() body: any,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    if (!actorId || !actorRole) throw new UnauthorizedException('Actor context is required');
    return this.service.execute(residentId, { ...body, actorId, actorRole });
  }
}
