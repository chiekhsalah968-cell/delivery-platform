import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { vehicleSchema, type VehicleInput } from '@delivery/shared';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { requestContext, type AuthenticatedUser } from '../../common/types';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@ApiBearerAuth()
@Roles('courier')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  @ApiOperation({ summary: 'List the courier’s vehicles' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.vehicles.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Register a vehicle' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(vehicleSchema)) body: VehicleInput,
    @Req() req: Request,
  ) {
    return this.vehicles.create(user.id, body, requestContext(req));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a vehicle' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(vehicleSchema)) body: VehicleInput,
    @Req() req: Request,
  ) {
    return this.vehicles.update(user.id, id, body, requestContext(req));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a vehicle' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.vehicles.remove(user.id, id, requestContext(req));
  }
}