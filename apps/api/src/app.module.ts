import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { parseApiEnv } from '@delivery/shared';
import { AuditModule } from './common/audit/audit.module';
import { AdminMfaGuard } from './common/guards/admin-mfa.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TokenModule } from './common/token/token.module';
import { TotpModule } from './common/totp/totp.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { GeoModule } from './modules/geo/geo.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: parseApiEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    PrismaModule,
    RedisModule,
    TokenModule,
    TotpModule,
    AuditModule,
    HealthModule,
    AuthModule,
    GeoModule,
    ProfilesModule,
    VehiclesModule,
    AddressesModule,
    OrdersModule,
    AdminModule,
  ],
  providers: [
    // Order matters: rate-limit first (brute-force protection on public auth routes),
    // then authentication, then role authorization, then admin 2FA enforcement.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: AdminMfaGuard },
  ],
})
export class AppModule {}