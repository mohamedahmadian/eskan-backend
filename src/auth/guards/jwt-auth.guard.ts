import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        act?: string;
        impersonating?: boolean;
      }>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { userRoles: { include: { role: true } } },
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException();
      }

      request.user = user;
      request.impersonating = payload.impersonating === true;
      request.impersonatedById =
        payload.impersonating === true && typeof payload.act === 'string'
          ? payload.act
          : null;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
