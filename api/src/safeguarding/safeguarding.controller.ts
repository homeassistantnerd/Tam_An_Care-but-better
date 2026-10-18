import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { SafeguardingService } from './safeguarding.service';

@Controller('api/safeguarding')
export class SafeguardingController {
  constructor(private readonly service: SafeguardingService) {}

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
