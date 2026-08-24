import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
} from '../common/pagination';
import { currentJalaliYear } from '../common/jalali-year';
import { resolveSortOrder } from '../common/sort-query';
import {
  IssuedLicenseStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIssuedLicenseDto } from './dto/create-issued-license.dto';
import {
  FindIssuedLicensesQueryDto,
  LookupCaravanManagerQueryDto,
} from './dto/find-issued-licenses-query.dto';

const personSelect = {
  id: true,
  fullName: true,
  firstName: true,
  lastName: true,
  nationalId: true,
  phone: true,
  status: true,
} satisfies Prisma.UserSelect;

const geoSelect = {
  id: true,
  nameFa: true,
  nameEn: true,
} satisfies Prisma.CitySelect;

const caravanLookupSelect = {
  id: true,
  name: true,
  officeAddress: true,
  officePhone: true,
  licenseNumber: true,
  foundedYear: true,
  isActive: true,
  city: {
    select: {
      ...geoSelect,
      provinceId: true,
      province: {
        select: {
          ...geoSelect,
          countryId: true,
        },
      },
    },
  },
} satisfies Prisma.CaravanSelect;

const licenseInclude = {
  manager: { select: personSelect },
  issuer: {
    select: {
      ...personSelect,
      issuingOrganization: {
        select: { id: true, name: true, phone: true },
      },
    },
  },
  approvedBy: { select: personSelect },
  revokedBy: { select: personSelect },
  organization: { select: { id: true, name: true, phone: true } },
  caravan: { select: caravanLookupSelect },
} satisfies Prisma.IssuedLicenseInclude;

type LicenseRecord = Prisma.IssuedLicenseGetPayload<{
  include: typeof licenseInclude;
}>;

@Injectable()
export class IssuedLicensesService {
  constructor(private readonly prisma: PrismaService) {}

  async lookupManager(query: LookupCaravanManagerQueryDto) {
    const manager = await this.prisma.user.findFirst({
      where: {
        nationalId: query.nationalId,
        userRoles: { some: { role: { code: 'CARAVAN_MANAGER' } } },
      },
      select: {
        ...personSelect,
        city: {
          select: {
            ...geoSelect,
            provinceId: true,
            province: { select: geoSelect },
          },
        },
        managedCaravans: {
          orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
          select: caravanLookupSelect,
        },
      },
    });

    if (!manager) {
      throw new NotFoundException('مدیر کاروان با این کد ملی یافت نشد');
    }

    const { managedCaravans, ...person } = manager;
    return {
      manager: person,
      caravans: managedCaravans,
    };
  }

  async findAll(query: FindIssuedLicensesQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    const [items, total] = await Promise.all([
      this.prisma.issuedLicense.findMany({
        where,
        include: licenseInclude,
        orderBy,
        skip,
        take,
      }),
      this.prisma.issuedLicense.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.issuedLicense.findFirst({
      where: { id },
      include: licenseInclude,
    });
    if (!item) {
      throw new NotFoundException('مجوز یافت نشد');
    }
    return this.serialize(item);
  }

  async create(dto: CreateIssuedLicenseDto, issuerUserId: string) {
    const manager = await this.prisma.user.findFirst({
      where: {
        id: dto.managerUserId,
        userRoles: { some: { role: { code: 'CARAVAN_MANAGER' } } },
      },
      select: { id: true },
    });
    if (!manager) {
      throw new BadRequestException('مدیر کاروان انتخاب‌شده معتبر نیست');
    }

    const caravan = await this.prisma.caravan.findFirst({
      where: {
        id: dto.caravanId,
        managerUserId: dto.managerUserId,
      },
      select: { id: true },
    });
    if (!caravan) {
      throw new BadRequestException('کاروان انتخاب‌شده متعلق به این مدیر نیست');
    }

    await this.assertFile(dto.fileId);

    const issuer = await this.prisma.user.findUnique({
      where: { id: issuerUserId },
      select: { issuingOrganizationId: true },
    });
    if (!issuer) {
      throw new BadRequestException('کاربر صادرکننده معتبر نیست');
    }

    const issuedAt = parseDateOnly(dto.issuedAt);
    if (!issuedAt) {
      throw new BadRequestException('تاریخ صدور معتبر نیست');
    }

    const autoApprove = await this.shouldAutoApproveLicenses();
    const item = await this.prisma.issuedLicense.create({
      data: {
        managerUserId: dto.managerUserId,
        caravanId: dto.caravanId,
        issuerUserId,
        organizationId: issuer.issuingOrganizationId,
        description: dto.description?.trim() || null,
        issuedAt,
        fileId: dto.fileId ?? null,
        status: autoApprove
          ? IssuedLicenseStatus.APPROVED
          : IssuedLicenseStatus.ISSUED,
        ...(autoApprove
          ? { approvedAt: new Date(), approvedById: issuerUserId }
          : {}),
      },
      include: licenseInclude,
    });
    return this.serialize(item);
  }

  private async shouldAutoApproveLicenses() {
    const year = currentJalaliYear();
    const settings = await this.prisma.receptionSettings.findUnique({
      where: { year },
      select: { caravanAutoApproveLicenses: true },
    });
    return Boolean(settings?.caravanAutoApproveLicenses);
  }

  async approve(id: string, approvedById: string) {
    const current = await this.prisma.issuedLicense.findFirst({
      where: { id },
      select: { id: true, status: true },
    });
    if (!current) {
      throw new NotFoundException('مجوز یافت نشد');
    }
    if (current.status === IssuedLicenseStatus.REVOKED) {
      throw new BadRequestException('مجوز ابطال‌شده قابل تأیید نیست');
    }
    if (current.status === IssuedLicenseStatus.APPROVED) {
      throw new BadRequestException('این مجوز قبلاً تأیید شده است');
    }

    const item = await this.prisma.issuedLicense.update({
      where: { id },
      data: {
        status: IssuedLicenseStatus.APPROVED,
        approvedAt: new Date(),
        approvedById,
      },
      include: licenseInclude,
    });
    return this.serialize(item);
  }

  async revoke(id: string, revokedById: string) {
    const current = await this.prisma.issuedLicense.findFirst({
      where: { id },
      select: { id: true, status: true },
    });
    if (!current) {
      throw new NotFoundException('مجوز یافت نشد');
    }
    if (current.status === IssuedLicenseStatus.REVOKED) {
      throw new BadRequestException('این مجوز قبلاً ابطال شده است');
    }

    const item = await this.prisma.issuedLicense.update({
      where: { id },
      data: {
        status: IssuedLicenseStatus.REVOKED,
        revokedAt: new Date(),
        revokedById,
      },
      include: licenseInclude,
    });
    return this.serialize(item);
  }

  private listWhere(
    query: FindIssuedLicensesQueryDto,
  ): Prisma.IssuedLicenseWhereInput {
    const filters: Prisma.IssuedLicenseWhereInput[] = [];
    if (query.status) {
      filters.push({ status: query.status });
    }
    if (query.caravanId) {
      filters.push({ caravanId: query.caravanId });
    }
    if (query.managerUserId) {
      filters.push({ managerUserId: query.managerUserId });
    }
    if (query.issuedAt) {
      const issuedAt = parseDateOnly(query.issuedAt);
      if (issuedAt) {
        filters.push({ issuedAt });
      }
    }
    if (query.q) {
      filters.push({
        OR: [
          { description: containsInsensitive(query.q) },
          { manager: { fullName: containsInsensitive(query.q) } },
          { manager: { nationalId: containsInsensitive(query.q) } },
          { manager: { phone: containsInsensitive(query.q) } },
          { caravan: { name: containsInsensitive(query.q) } },
          { caravan: { licenseNumber: containsInsensitive(query.q) } },
          { issuer: { fullName: containsInsensitive(query.q) } },
          { approvedBy: { fullName: containsInsensitive(query.q) } },
          { revokedBy: { fullName: containsInsensitive(query.q) } },
          { organization: { name: containsInsensitive(query.q) } },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private listOrderBy(
    query: FindIssuedLicensesQueryDto,
  ): Prisma.IssuedLicenseOrderByWithRelationInput[] {
    const dir = query.sortDir;
    // issuedAt is DATE-only; list cell shows createdAt time — same-day order must follow it
    if (query.sortBy === 'issuedAt' && (dir === 'asc' || dir === 'desc')) {
      return [{ issuedAt: dir }, { createdAt: dir }, { id: 'asc' }];
    }
    return resolveSortOrder<Prisma.IssuedLicenseOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        status: (d) => ({ status: d }),
        manager: (d) => ({ manager: { fullName: d } }),
        caravan: (d) => ({ caravan: { name: d } }),
        createdAt: (d) => ({ createdAt: d }),
      },
      [{ issuedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  private async assertFile(fileId?: string | null) {
    if (!fileId) {
      return;
    }
    const image = await this.prisma.storedImage.findUnique({
      where: { id: fileId },
      select: { id: true },
    });
    if (!image) {
      throw new BadRequestException('فایل مجوز معتبر نیست');
    }
  }

  private serialize(item: LicenseRecord) {
    const { issuingOrganization, ...issuer } = item.issuer;
    return {
      id: item.id,
      managerUserId: item.managerUserId,
      caravanId: item.caravanId,
      issuerUserId: item.issuerUserId,
      organizationId: item.organizationId ?? issuingOrganization?.id ?? null,
      description: item.description,
      issuedAt: toDateOnly(item.issuedAt),
      status: item.status,
      revokedAt: item.revokedAt?.toISOString() ?? null,
      revokedById: item.revokedById,
      approvedAt: item.approvedAt?.toISOString() ?? null,
      approvedById: item.approvedById,
      fileId: item.fileId,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      manager: item.manager,
      issuer,
      approvedBy: item.approvedBy,
      revokedBy: item.revokedBy,
      organization: item.organization ?? issuingOrganization ?? null,
      caravan: item.caravan,
    };
  }
}

function parseDateOnly(value?: string | null) {
  if (value == null || value === '') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}
