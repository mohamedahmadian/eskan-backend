import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type ImpersonationContext = {
  impersonating: boolean;
  actorId: string | null;
};

export const Impersonation = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ImpersonationContext => {
    const request = ctx.switchToHttp().getRequest<{
      impersonating?: boolean;
      impersonatedById?: string | null;
    }>();
    return {
      impersonating: Boolean(request.impersonating),
      actorId: request.impersonatedById ?? null,
    };
  },
);
