import { SetMetadata } from '@nestjs/common';
import type { Role } from '@delivery/shared';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles. Enforced by RolesGuard after authentication. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);