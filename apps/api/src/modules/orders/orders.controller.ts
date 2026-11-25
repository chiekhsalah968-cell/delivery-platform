import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  orderCancelSchema,
  orderCreateSchema,
  orderQuerySchema,
  type OrderCancelInput,
  type OrderCreateInput,
  type OrderQuery,
} from '@delivery/shared';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { requestContext, type AuthenticatedUser } from '../../common/types';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @Roles('merchant')
  @ApiOperation({ summary: 'Create a delivery order (merchants only)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(orderCreateSchema)) body: OrderCreateInput,
    @Req() req: Request,
  ) {
    return this.orders.create(user, body, requestContext(req));
  }

  @Get()
  @ApiOperation({ summary: 'List orders visible to the caller (scoped by role)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(orderQuerySchema)) query: OrderQuery,
  ) {
    return this.orders.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single order the caller is allowed to see' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.getById(user, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an order before pickup (merchant, customer, or admin)' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(orderCancelSchema)) body: OrderCancelInput,
    @Req() req: Request,
  ) {
    return this.orders.cancel(user, id, body, requestContext(req));
  }
}
