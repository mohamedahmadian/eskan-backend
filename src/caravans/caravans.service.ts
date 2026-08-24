import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isAdmin, type RoleBearer } from '../auth/roles.util';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateCaravanDto } from './dto/create-caravan.dto';
import { FindCaravansQueryDto } from './dto/find-caravans-query.dto';
import { UpdateCaravanDto } from './dto/update-caravan.dto';

const caravanInclude = {
  city: {
    select: {
      id: true,
      nameFa: true,
      nameEn: true,
      provinceId: true,
      province: {
        select: {
          id: true,
          nameFa: true,
          nameEn: true,
          countryId: true,
          country: {
            select: {
              id: true,
              nameFa: true,
              nameEn: true,
            },
          },
        },
      },
    },
  },
  manager: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      nationalId: true,
      phone: true,
      birthDate: true,
      status: true,
    },
  },
  contacts: {
    orderBy: { role: 'asc' },
    select: {
      id: true,
      role: true,
      userId: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          nationalId: true,
          phone: true,
          birthDate: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.CaravanInclude;

@Injectable()
export class CaravansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async findAll(query: FindCaravansQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    const [items, total] = await Promise.all([
      this.prisma.caravan.findMany({
        where,
        include: caravanInclude,
        orderBy,
        skip,
        take,
      }),
      this.prisma.caravan.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  async findMine(query: FindCaravansQueryDto, managerUserId: string) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const searchWhere = this.listWhere(query);
    const where: Prisma.CaravanWhereInput = {
      managerUserId,
      ...(searchWhere ? searchWhere : {}),
    };
    const orderBy = this.listOrderBy(query);
    const [items, total] = await Promise.all([
      this.prisma.caravan.findMany({
        where,
        include: caravanInclude,
        orderBy,
        skip,
        take,
      }),
      this.prisma.caravan.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  private listOrderBy(
    query: FindCaravansQueryDto,
  ): Prisma.CaravanOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.CaravanOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        isActive: (dir) => ({ isActive: dir }),
        city: (dir) => ({ city: { nameFa: dir } }),
        manager: (dir) => ({ manager: { fullName: dir } }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  async findOne(id: string) {
    const caravan = await this.prisma.caravan.findUnique({
      where: { id },
      include: caravanInclude,
    });
    if (!caravan) {
      throw new NotFoundException('کاروان یافت نشد');
    }
    return caravan;
  }

  private listWhere(query: FindCaravansQueryDto): Prisma.CaravanWhereInput | undefined {
    if (!query.q) return undefined;
    return {
      OR: [
        { name: containsInsensitive(query.q) },
        { description: containsInsensitive(query.q) },
        { officeAddress: containsInsensitive(query.q) },
        { officePhone: containsInsensitive(query.q) },
        { licenseNumber: containsInsensitive(query.q) },
        { city: { nameFa: containsInsensitive(query.q) } },
        { city: { nameEn: containsInsensitive(query.q) } },
        { manager: { fullName: containsInsensitive(query.q) } },
        { manager: { nationalId: containsInsensitive(query.q) } },
        { manager: { phone: containsInsensitive(query.q) } },
        { eitaa: containsInsensitive(query.q) },
        { bale: containsInsensitive(query.q) },
        { telegram: containsInsensitive(query.q) },
        { instagram: containsInsensitive(query.q) },
      ],
    };
  }

  async create(dto: CreateCaravanDto, actor: RoleBearer & { id: string }) {
    const cityId = await this.resolveCityId(dto.cityId, actor.id);
    await this.assertLicenseImage(dto.licenseImageId);

    const managerUserId = isAdmin(actor)
      ? dto.managerUserId
      : actor.id;
    const resolved = await this.resolveManager(managerUserId);

    const caravan = await this.prisma.caravan.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        officeAddress: dto.officeAddress?.trim() || null,
        officePhone: dto.officePhone?.trim() || null,
        foundedYear: dto.foundedYear ?? null,
        cityId,
        licenseNumber: dto.licenseNumber?.trim() || null,
        licenseImageId: dto.licenseImageId ?? null,
        managerUserId: resolved.managerUserId,
        maleCount: dto.maleCount ?? 0,
        femaleCount: dto.femaleCount ?? 0,
        totalCount: (dto.maleCount ?? 0) + (dto.femaleCount ?? 0),
        eitaa: dto.eitaa?.trim() || null,
        bale: dto.bale?.trim() || null,
        telegram: dto.telegram?.trim() || null,
        instagram: dto.instagram?.trim() || null,
        isActive: dto.isActive ?? true,
      },
      include: caravanInclude,
    });

    if (dto.contacts) {
      await this.syncContacts(caravan.id, dto.contacts);
      return this.findOne(caravan.id);
    }

    return caravan;
  }

  async update(
    id: string,
    dto: UpdateCaravanDto,
    actor: RoleBearer & { id: string },
  ) {
    const current = await this.findOne(id);
    if (dto.cityId) {
      await this.assertCity(dto.cityId);
    }
    if (dto.licenseImageId !== undefined) {
      await this.assertLicenseImage(dto.licenseImageId);
    }

    let resolved: { managerUserId: string } | null = null;
    if (isAdmin(actor)) {
      if (dto.managerUserId !== undefined) {
        resolved = await this.resolveManager(dto.managerUserId);
      }
    } else if (current.managerUserId !== actor.id) {
      throw new ForbiddenException('امکان ویرایش این کاروان وجود ندارد');
    } else if (dto.managerUserId && dto.managerUserId !== actor.id) {
      throw new ForbiddenException('امکان تغییر مدیر کاروان وجود ندارد');
    }

    const maleCount =
      dto.maleCount !== undefined ? dto.maleCount : current.maleCount;
    const femaleCount =
      dto.femaleCount !== undefined ? dto.femaleCount : current.femaleCount;
    const countsChanged =
      dto.maleCount !== undefined || dto.femaleCount !== undefined;

    const caravan = await this.prisma.caravan.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        officeAddress:
          dto.officeAddress === undefined
            ? undefined
            : dto.officeAddress?.trim() || null,
        officePhone:
          dto.officePhone === undefined
            ? undefined
            : dto.officePhone?.trim() || null,
        foundedYear:
          dto.foundedYear === undefined ? undefined : dto.foundedYear,
        cityId: dto.cityId,
        licenseNumber:
          dto.licenseNumber === undefined
            ? undefined
            : dto.licenseNumber?.trim() || null,
        licenseImageId:
          dto.licenseImageId === undefined ? undefined : dto.licenseImageId,
        managerUserId: resolved ? resolved.managerUserId : undefined,
        maleCount: dto.maleCount,
        femaleCount: dto.femaleCount,
        totalCount: countsChanged ? maleCount + femaleCount : undefined,
        eitaa: dto.eitaa === undefined ? undefined : dto.eitaa?.trim() || null,
        bale: dto.bale === undefined ? undefined : dto.bale?.trim() || null,
        telegram:
          dto.telegram === undefined ? undefined : dto.telegram?.trim() || null,
        instagram:
          dto.instagram === undefined ? undefined : dto.instagram?.trim() || null,
        isActive: isAdmin(actor) ? dto.isActive : undefined,
      },
      include: caravanInclude,
    });

    if (dto.contacts !== undefined) {
      await this.syncContacts(id, dto.contacts);
      return this.findOne(id);
    }

    return caravan;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.caravan.delete({ where: { id } });
    return { ok: true };
  }

  count() {
    return this.prisma.caravan.count();
  }

  private async resolveManager(managerUserId?: string | null) {
    if (!managerUserId) {
      throw new BadRequestException(
        'مدیر کاروان را از فهرست زائران انتخاب کنید',
      );
    }

    await this.users.assertHasRole(
      managerUserId,
      'PILGRIM',
      'مدیر کاروان باید از میان زائران انتخاب شود',
    );
    await this.users.ensureRole(managerUserId, 'CARAVAN_MANAGER');
    return { managerUserId };
  }

  private async resolveCityId(cityId: string | null | undefined, actorId: string) {
    const resolved = cityId || (await this.actorCityId(actorId));
    if (!resolved) {
      throw new BadRequestException('شهر انتخاب‌شده معتبر نیست');
    }
    await this.assertCity(resolved);
    return resolved;
  }

  private async actorCityId(actorId: string) {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { cityId: true },
    });
    return actor?.cityId ?? null;
  }

  private async assertCity(cityId: string) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!city) {
      throw new BadRequestException('شهر انتخاب‌شده معتبر نیست');
    }
  }

  private async assertLicenseImage(imageId?: string | null) {
    if (!imageId) return;
    const image = await this.prisma.storedImage.findUnique({
      where: { id: imageId },
      select: { id: true },
    });
    if (!image) {
      throw new BadRequestException('تصویر مجوز معتبر نیست');
    }
  }

  private async syncContacts(
    caravanId: string,
    contacts: NonNullable<CreateCaravanDto['contacts']>,
  ) {
    if (!contacts.length) {
      await this.prisma.caravanContact.deleteMany({ where: { caravanId } });
      return;
    }

    const roles = contacts.map((item) => item.role);
    await this.prisma.caravanContact.deleteMany({
      where: {
        caravanId,
        role: { notIn: roles },
      },
    });

    for (const contact of contacts) {
      const { user } = await this.users.findOrCreatePilgrim({
        firstName: contact.firstName,
        lastName: contact.lastName,
        nationalId: contact.nationalId,
        phone: contact.phone,
        birthDate: contact.birthDate ?? null,
      });

      await this.prisma.caravanContact.upsert({
        where: {
          caravanId_role: { caravanId, role: contact.role },
        },
        create: {
          caravanId,
          role: contact.role,
          userId: user.id,
        },
        update: {
          userId: user.id,
        },
      });
    }
  }
}
