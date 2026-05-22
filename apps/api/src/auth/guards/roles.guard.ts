import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../generated/prisma';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.editor]: 1,
  [UserRole.reviewer]: 2,
  [UserRole.admin]: 3,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;
    if (!user) return false;

    const userLevel = ROLE_HIERARCHY[user.role] ?? 0;
    return requiredRoles.some((role) => userLevel >= (ROLE_HIERARCHY[role] ?? 0));
  }
}
