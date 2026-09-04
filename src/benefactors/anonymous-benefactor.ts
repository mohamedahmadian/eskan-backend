import { PrismaService } from '../prisma/prisma.service';

export const ANONYMOUS_BENEFACTOR_CODE = 'ANONYMOUS';
export const ANONYMOUS_BENEFACTOR_NAME = 'ناشناس';

export async function ensureAnonymousBenefactor(prisma: PrismaService) {
  const existing = await prisma.benefactor.findUnique({
    where: { code: ANONYMOUS_BENEFACTOR_CODE },
  });
  if (existing) {
    return existing;
  }
  return prisma.benefactor.create({
    data: {
      code: ANONYMOUS_BENEFACTOR_CODE,
      firstName: ANONYMOUS_BENEFACTOR_NAME,
      lastName: '',
      name: ANONYMOUS_BENEFACTOR_NAME,
    },
  });
}
