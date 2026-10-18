import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { SkinWoundService } from './skin-wound.service';

@Controller('api/skin-wound')
export class SkinWoundController {
  constructor(
    private readonly service: SkinWoundService,
  ) {}

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
    body = { ...body, actorId, actorRole };
    return this.service.execute(
      residentId,
      body,
    );
  }
}
