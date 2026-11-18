import { Body, Controller, Get, Patch, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  courierAvailabilitySchema,
  courierLocationSchema,
  courierProfileSchema,
  customerProfileSchema,
  merchantProfileSchema,
  type CourierAvailabilityInput,
  type CourierLocationInput,
  type CourierProfileInput,
  type CustomerProfileInput,
  type MerchantProfileInput,
} from '@delivery/shared';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { requestContext, type AuthenticatedUser } from '../../common/types';
import { ProfilesService } from './profiles.service';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Return the authenticated user’s profile, vehicles, and addresses' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.getMyProfile(user);
  }

  @Put('me/customer')
  @Roles('customer')
  @ApiOperation({ summary: 'Create or update the customer profile' })
  upsertCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(customerProfileSchema)) body: CustomerProfileInput,
    @Req() req: Request,
  ) {
    return this.profiles.upsertCustomerProfile(user.id, body, requestContext(req));
  }

  @Put('me/merchant')
  @Roles('merchant')
  @ApiOperation({ summary: 'Create or update the merchant profile' })
  upsertMerchant(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(merchantProfileSchema)) body: MerchantProfileInput,
    @Req() req: Request,
  ) {
    return this.profiles.upsertMerchantProfile(user.id, body, requestContext(req));
  }

  @Put('me/courier')
  @Roles('courier')
  @ApiOperation({ summary: 'Create or update the courier profile' })
  upsertCourier(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(courierProfileSchema)) body: CourierProfileInput,
    @Req() req: Request,
  ) {
    return this.profiles.upsertCourierProfile(user.id, body, requestContext(req));
  }

  @Patch('me/courier/availability')
  @Roles('courier')
  @ApiOperation({ summary: 'Set courier availability (offline/online/busy)' })
  setAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(courierAvailabilitySchema)) body: CourierAvailabilityInput,
    @Req() req: Request,
  ) {
    return this.profiles.setAvailability(user.id, body, requestContext(req));
  }

  @Patch('me/courier/location')
  @Roles('courier')
  @ApiOperation({ summary: 'Update the courier’s current GPS location' })
  setLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(courierLocationSchema)) body: CourierLocationInput,
    @Req() req: Request,
  ) {
    return this.profiles.setLocation(user.id, body, requestContext(req));
  }
}