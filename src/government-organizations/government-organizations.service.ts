import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGovernmentOrganizationDto } from './dto/create-government-organization.dto';
import { FindGovernmentOrganizationsQueryDto } from './dto/find-government-organizations-query.dto';
import { UpdateGovernmentOrganizationDto } from './dto/update-government-organization.dto';

const contactUserSelect = {
  id: true,
  fullName: true,
  phone: true,
  nationalId: true,
} as const;

const contactInclude = {
  contactUser: { select: contactUserSelect },
} satisfies Prisma.GovernmentOrganizationInclude;

type ContactUserRecord = {
  id: string;
  issuingOrganizationId: string | null;
};

@Injectable()
export class GovernmentOrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindGovernmentOrganizationsQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      return this.prisma.governmentOrganization.findMany({
        where,
        orderBy,
        include: contactInclude,
      });
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.governmentOrganization.findMany({
        where,
        orderBy,
        skip,
        take,
        include: contactInclude,
      }),
      this.prisma.governmentOrganization.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  private listOrderBy(
    query: FindGovernmentOrganizationsQueryDto,
  ): Prisma.GovernmentOrganizationOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.GovernmentOrganizationOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        phone: (dir) => ({ phone: dir }),
        contactPerson: (dir) => ({ contactUser: { fullName: dir } }),
        mobile: (dir) => ({ mobile: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.governmentOrganization.findUnique({
      where: { id },
      include: contactInclude,
    });
    if (!item) {
      throw new NotFoundException('سازمان یافت نشد');
    }
    return item;
  }

  async create(dto: CreateGovernmentOrganizationDto) {
    const contactUser = await this.assertContactUser(dto.contactUserId);
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.governmentOrganization.create({
        data: {
          name: dto.name.trim(),
          phone: dto.phone?.trim() || null,
          address: dto.address?.trim() || null,
          contactUserId: contactUser?.id ?? null,
          mobile: dto.mobile?.trim() || null,
          description: dto.description?.trim() || null,
        },
        include: contactInclude,
      });
      await this.linkOfficerToOrganization(tx, contactUser, item.id);
      return item;
    });
  }

  async update(id: string, dto: UpdateGovernmentOrganizationDto) {
    await this.findOne(id);
    const contactUser =
      dto.contactUserId === undefined
        ? undefined
        : await this.assertContactUser(dto.contactUserId, id);
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.governmentOrganization.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          phone: dto.phone === undefined ? undefined : dto.phone?.trim() || null,
          address:
            dto.address === undefined ? undefined : dto.address?.trim() || null,
          contactUserId:
            dto.contactUserId === undefined
              ? undefined
              : (contactUser?.id ?? null),
          mobile:
            dto.mobile === undefined ? undefined : dto.mobile?.trim() || null,
          description:
            dto.description === undefined
              ? undefined
              : dto.description?.trim() || null,
        },
        include: contactInclude,
      });
      if (contactUser) {
        await this.linkOfficerToOrganization(tx, contactUser, item.id);
      }
      return item;
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const userCount = await this.prisma.user.count({
      where: { issuingOrganizationId: id },
    });
    if (userCount) {
      throw new BadRequestException(
        'ابتدا کاربران متصل به این سازمان را اصلاح کنید',
      );
    }
    const requestCount = await this.prisma.supportRequest.count({
      where: {
        OR: [{ organizationId: id }, { handlingOrganizationId: id }],
      },
    });
    if (requestCount) {
      throw new BadRequestException(
        'ابتدا درخواست‌های پشتیبانی متصل به این سازمان را اصلاح کنید',
      );
    }
    await this.prisma.governmentOrganization.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(
    query: FindGovernmentOrganizationsQueryDto,
  ): Prisma.GovernmentOrganizationWhereInput {
    if (!query.q) {
      return {};
    }
    return {
      OR: [
        { name: containsInsensitive(query.q) },
        { phone: containsInsensitive(query.q) },
        { address: containsInsensitive(query.q) },
        { mobile: containsInsensitive(query.q) },
        { description: containsInsensitive(query.q) },
        { contactUser: { fullName: containsInsensitive(query.q) } },
        { contactUser: { phone: containsInsensitive(query.q) } },
        { contactUser: { nationalId: containsInsensitive(query.q) } },
      ],
    };
  }

  private async assertContactUser(
    userId?: string | null,
    organizationId?: string,
  ): Promise<ContactUserRecord | null> {
    if (userId == null || userId === '') {
      return null;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        issuingOrganizationId: true,
        userRoles: { select: { role: { select: { code: true } } } },
      },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new BadRequestException('مسئول مربوطه معتبر نیست');
    }
    if (
      !user.userRoles.some(
        (item) => item.role.code === 'GOVERNMENT_ORG_OFFICER',
      )
    ) {
      throw new BadRequestException(
        'مسئول مربوطه باید نقش مسئول سازمان‌ها و ارگان‌های دولتی داشته باشد',
      );
    }
    if (
      user.issuingOrganizationId &&
      user.issuingOrganizationId !== organizationId
    ) {
      throw new BadRequestException('این مسئول به سازمان دیگری متصل است');
    }
    const taken = await this.prisma.governmentOrganization.findFirst({
      where: {
        contactUserId: user.id,
        ...(organizationId ? { id: { not: organizationId } } : {}),
      },
      select: { id: true },
    });
    if (taken) {
      throw new BadRequestException('این کاربر مسئول سازمان دیگری است');
    }
    return {
      id: user.id,
      issuingOrganizationId: user.issuingOrganizationId,
    };
  }

  private async linkOfficerToOrganization(
    tx: Prisma.TransactionClient,
    contactUser: ContactUserRecord | null | undefined,
    organizationId: string,
  ) {
    if (!contactUser || contactUser.issuingOrganizationId) {
      return;
    }
    await tx.user.update({
      where: { id: contactUser.id },
      data: { issuingOrganizationId: organizationId },
    });
  }
}
