import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles?.length || roles.includes('AUTHENTICATED')) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as
      | {
          userRoles?: { role: { code: string } }[];
          roles?: { code: string }[];
        }
      | undefined;
    const codes = new Set(
      user?.userRoles?.map((item) => item.role.code) ??
        user?.roles?.map((role) => role.code) ??
        [],
    );

    if (![...codes].some((code) => roles.includes(code))) {
      throw new ForbiddenException('دسترسی به این بخش مجاز نیست');
    }

    return true;
  }
}
