import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { addressSchema, type AddressInput } from '@delivery/shared';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { requestContext, type AuthenticatedUser } from '../../common/types';
import { AddressesService } from './addresses.service';

@ApiTags('addresses')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'List the user’s saved addresses' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.addresses.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Save a new address' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(addressSchema)) body: AddressInput,
    @Req() req: Request,
  ) {
    return this.addresses.create(user.id, body, requestContext(req));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an address' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addressSchema)) body: AddressInput,
    @Req() req: Request,
  ) {
    return this.addresses.update(user.id, id, body, requestContext(req));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove an address' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.addresses.remove(user.id, id, requestContext(req));
  }
}