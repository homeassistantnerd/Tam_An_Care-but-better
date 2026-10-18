import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  InternalServerErrorException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import {
  NutritionHydrationService,
} from './nutrition-hydration.service';

import {
  NutritionCommand,
} from './nutrition-hydration.types';
import { ResidentAccessScopeService } from '../resident-access-scope/resident-access-scope.service';

@Controller('api/nutrition-hydration')
export class NutritionHydrationController {
  constructor(
    private readonly service:
      NutritionHydrationService,
    private readonly residentScope: ResidentAccessScopeService,
  ) {}

  private handle(error: unknown): never {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown nutrition error.';

    const businessMarkers = [
      'required',
      'not found',
      'Only ',
      'only ',
      'cannot ',
      'may ',
      'must ',
      'authorization',
      'authorized',
      'Invalid ',
      'requires ',
      'Explicit ',
      'accountable human',
      'AI or SYSTEM',
      'SYSTEM cannot',
      'AI may',
    ];

    if (
      businessMarkers.some(
        marker => message.includes(marker),
      )
    ) {
      throw new BadRequestException(message);
    }

    throw new InternalServerErrorException(
      'Unable to process Nutrition/Hydration request.',
    );
  }

  @Post(':residentId/execute')
  async execute(
    @Param('residentId') residentId: string,
    @Body() body: NutritionCommand,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    if (!actorId || !actorRole) throw new UnauthorizedException('Actor context is required');
    await this.residentScope.assertClinicalWriteAccess(actorId, actorRole, residentId);
    body = { ...body, actorId, actorRole } as NutritionCommand;
    try {
      const data =
        await this.service.execute(
          residentId,
          body,
        );

      return {
        status: 'OK',
        data,
        autonomousClinicalAction: false,
      };
    } catch (error: unknown) {
      return this.handle(error);
    }
  }

  @Get(':residentId/summary')
  async summary(
    @Param('residentId') residentId: string,
  ) {
    return {
      residentId,
      domain: 'NUTRITION_HYDRATION',
      aiBoundary: {
        analysisAllowed: true,
        alertAllowed: true,
        advisoryOnly: true,
        autonomousClinicalAction: false,
        officialDietMutation: false,
        fluidRestrictionMutation: false,
        medicationMutation: false,
      },
    };
  }
}
