import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { isAdmin } from '../auth/roles.util';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import { Prisma, Religion, UserGender, UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { cleanPlates, joinFullName } from './user-profile.util';

const roleSelect = {
  id: true,
  code: true,
  nameKey: true,
} satisfies Prisma.RoleSelect;

const geoSelect = {
  id: true,
  nameFa: true,
  nameEn: true,
} satisfies Prisma.CountrySelect;

const publicInclude = {
  userRoles: {
    include: { role: { select: roleSelect } },
  },
  country: { select: geoSelect },
  province: { select: { ...geoSelect, countryId: true } },
  city: { select: { ...geoSelect, provinceId: true } },
  managedAccommodations: {
    where: { isPrimary: true },
    orderBy: { year: 'desc' as const },
    take: 1,
    include: {
      accommodation: { select: { id: true, name: true } },
    },
  },
  representedProvinces: {
    orderBy: { nameFa: 'asc' as const },
    select: { id: true, nameFa: true, nameEn: true },
  },
  representedCities: {
    orderBy: { nameFa: 'asc' as const },
    select: {
      id: true,
      nameFa: true,
      nameEn: true,
      provinceId: true,
      province: { select: geoSelect },
    },
  },
  _count: {
    select: {
      managedAccommodations: true,
      representedProvinces: true,
      representedCities: true,
    },
  },
} satisfies Prisma.UserInclude;

type PublicUserSource = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  locale: string;
  status: UserStatus;
  gender: UserGender | null;
  nationalId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  religion: Religion | null;
  religionOther: string | null;
  telegram: string | null;
  bale: string | null;
  eitaa: string | null;
  whatsapp: string | null;
  otherSocial: string | null;
  vehiclePlates: string[];
  countryId: string | null;
  provinceId: string | null;
  cityId: string | null;
  photoId: string | null;
  nationalCardPhotoId: string | null;
  passportPhotoId: string | null;
  createdAt: Date;
  updatedAt: Date;
  country: { id: string; nameFa: string; nameEn: string } | null;
  province: { id: string; nameFa: string; nameEn: string; countryId: string } | null;
  city: { id: string; nameFa: string; nameEn: string; provinceId: string } | null;
  userRoles: { role: { id: string; code: string; nameKey: string } }[];
  managedAccommodations: {
    id: string;
    year: number;
    isPrimary: boolean;
    createdAt: Date;
    accommodation: { id: string; name: string; type?: string; status?: string };
  }[];
  representedProvinces: { id: string; nameFa: string; nameEn: string }[];
  representedCities: {
    id: string;
    nameFa: string;
    nameEn: string;
    provinceId: string;
    province: { id: string; nameFa: string; nameEn: string };
  }[];
  _count: {
    managedAccommodations: number;
    representedProvinces: number;
    representedCities: number;
  };
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  listRoles() {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      select: roleSelect,
    });
  }

  countByRole(roleCode: string) {
    return this.prisma.user.count({
      where: { userRoles: { some: { role: { code: roleCode } } } },
    });
  }

  async findAll(query: FindUsersQueryDto) {
    const where = this.listWhere(query);
    const findMany = {
      where,
      orderBy: { createdAt: 'desc' as const },
      include: publicInclude,
    };

    if (!wantsPagination(query)) {
      const items = await this.prisma.user.findMany(findMany);
      return items.map((item) => this.toPublicUser(item));
    }

    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ ...findMany, skip, take }),
      this.prisma.user.count({ where }),
    ]);

    return paginatedResult(
      items.map((item) => this.toPublicUser(item)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        ...publicInclude,
        managedAccommodations: {
          orderBy: [{ year: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'asc' }],
          include: {
            accommodation: {
              select: { id: true, name: true, type: true, status: true },
            },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }
    return this.toPublicUser(user, true);
  }

  async create(dto: CreateUserDto) {
    const roleIds = await this.assertRolesExist(dto.roleIds);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const geo = await this.resolveGeo(dto);
    await this.assertImages(dto);

    try {
      const user = await this.prisma.user.create({
        data: {
          ...(this.toUserData(dto, geo) as Prisma.UserUncheckedCreateInput),
          username: dto.username.trim(),
          passwordHash,
          locale: dto.locale ?? 'fa',
          status: dto.status ?? UserStatus.ACTIVE,
          userRoles: {
            create: roleIds.map((roleId) => ({ roleId })),
          },
        },
        include: publicInclude,
      });
      return this.toPublicUser(user);
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    const current = await this.findOne(id);

    if (dto.roleIds) {
      await this.assertRolesExist(dto.roleIds);
      await this.assertNotLastAdmin(current, dto.roleIds);
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : undefined;
    const geo = await this.resolveGeo({
      countryId: dto.countryId === undefined ? current.countryId : dto.countryId,
      provinceId: dto.provinceId === undefined ? current.provinceId : dto.provinceId,
      cityId: dto.cityId === undefined ? current.cityId : dto.cityId,
    });
    await this.assertImages(dto);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        if (dto.roleIds) {
          await tx.userRole.deleteMany({ where: { userId: id } });
          await tx.userRole.createMany({
            data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
          });
        }

        return tx.user.update({
          where: { id },
          data: {
            ...(this.toUserData(dto, geo) as Prisma.UserUncheckedUpdateInput),
            username: dto.username?.trim(),
            passwordHash,
            locale: dto.locale,
          },
          include: publicInclude,
        });
      });
      return this.toPublicUser(user);
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException('امکان حذف حساب خودتان وجود ندارد');
    }

    const current = await this.findOne(id);
    await this.assertNotLastAdmin(current);

    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  async ensureRole(userId: string, roleCode: string) {
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) {
      throw new BadRequestException('نقش انتخاب‌شده معتبر نیست');
    }
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });
    return role;
  }

  async createWithRole(dto: CreateUserDto, roleCode: string) {
    const role = await this.ensureExistingRole(roleCode);
    const roleIds = [...new Set([...(dto.roleIds ?? []), role.id])];
    return this.create({ ...dto, roleIds });
  }

  async updateKeepingRole(id: string, dto: UpdateUserDto, roleCode: string) {
    await this.assertHasRole(id, roleCode);
    if (dto.roleIds) {
      const role = await this.ensureExistingRole(roleCode);
      if (!dto.roleIds.includes(role.id)) {
        dto = { ...dto, roleIds: [...dto.roleIds, role.id] };
      }
    }
    return this.update(id, dto);
  }

  async removeRole(userId: string, roleCode: string, actorId: string) {
    const current = await this.findOne(userId);
    const remainingIds = current.roles
      .filter((role) => role.code !== roleCode)
      .map((role) => role.id);

    if (remainingIds.length === current.roles.length) {
      return this.findOne(userId);
    }

    if (remainingIds.length === 0) {
      return this.remove(userId, actorId);
    }

    await this.assertNotLastAdmin(current, remainingIds);
    await this.prisma.$transaction(async (tx) => {
      if (roleCode === 'ACCOMMODATION_MANAGER') {
        await tx.accommodationManager.deleteMany({ where: { userId } });
      }
      if (roleCode === 'HEADQUARTERS_REPRESENTATIVE') {
        await tx.province.updateMany({
          where: { representativeId: userId },
          data: { representativeId: null },
        });
        await tx.city.updateMany({
          where: { representativeId: userId },
          data: { representativeId: null },
        });
      }
      await tx.userRole.deleteMany({
        where: { userId, role: { code: roleCode } },
      });
    });
    return this.findOne(userId);
  }

  async assertHasRole(id: string, roleCode: string, notFoundMessage = 'کاربر یافت نشد') {
    const user = await this.findOne(id);
    if (!user.roles.some((role) => role.code === roleCode)) {
      throw new NotFoundException(notFoundMessage);
    }
    return user;
  }

  async assignProvince(userId: string, provinceId: string) {
    await this.assertHasRole(userId, 'HEADQUARTERS_REPRESENTATIVE', 'نماینده ستاد یافت نشد');
    const province = await this.prisma.province.findUnique({
      where: { id: provinceId },
      include: { representative: { select: { fullName: true } } },
    });
    if (!province) {
      throw new BadRequestException('استان انتخاب‌شده معتبر نیست');
    }
    if (province.representativeId && province.representativeId !== userId) {
      throw new ConflictException(
        `این استان هم‌اکنون نماینده دارد (${province.representative?.fullName ?? ''})`,
      );
    }
    if (province.representativeId !== userId) {
      await this.prisma.province.update({
        where: { id: provinceId },
        data: { representativeId: userId },
      });
    }
    return this.findOne(userId);
  }

  async unassignProvince(userId: string, provinceId: string) {
    await this.assertHasRole(userId, 'HEADQUARTERS_REPRESENTATIVE', 'نماینده ستاد یافت نشد');
    const province = await this.prisma.province.findUnique({ where: { id: provinceId } });
    if (!province || province.representativeId !== userId) {
      throw new NotFoundException('این استان به این نماینده اختصاص داده نشده است');
    }
    await this.prisma.province.update({
      where: { id: provinceId },
      data: { representativeId: null },
    });
    return this.findOne(userId);
  }

  async assignCity(userId: string, cityId: string) {
    await this.assertHasRole(userId, 'HEADQUARTERS_REPRESENTATIVE', 'نماینده ستاد یافت نشد');
    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      include: {
        representative: { select: { fullName: true } },
        province: { select: { representativeId: true, nameFa: true } },
      },
    });
    if (!city) {
      throw new BadRequestException('شهر انتخاب‌شده معتبر نیست');
    }
    if (!city.province.representativeId) {
      throw new BadRequestException(
        'تا وقتی نماینده استان تعیین نشده، این شهر نماینده ستاد ندارد',
      );
    }
    if (city.representativeId && city.representativeId !== userId) {
      throw new ConflictException(
        `این شهر هم‌اکنون نماینده دارد (${city.representative?.fullName ?? ''})`,
      );
    }
    if (city.representativeId !== userId) {
      await this.prisma.city.update({
        where: { id: cityId },
        data: { representativeId: userId },
      });
    }
    return this.findOne(userId);
  }

  async assignAccommodation(userId: string, accommodationId: string, year: number) {
    await this.assertHasRole(userId, 'ACCOMMODATION_MANAGER', 'مدیر اسکان یافت نشد');
    const accommodation = await this.prisma.accommodation.findUnique({
      where: { id: accommodationId },
      select: { id: true },
    });
    if (!accommodation) {
      throw new BadRequestException('اسکان انتخاب‌شده معتبر نیست');
    }

    const existing = await this.prisma.accommodationManager.findUnique({
      where: {
        userId_accommodationId_year: { userId, accommodationId, year },
      },
    });
    if (existing) {
      throw new ConflictException('این اسکان برای این سال قبلاً به این مدیر تخصیص داده شده است');
    }

    const hasPrimaryThisYear = await this.prisma.accommodationManager.findFirst({
      where: { userId, year, isPrimary: true },
      select: { id: true },
    });

    await this.prisma.accommodationManager.create({
      data: {
        userId,
        accommodationId,
        year,
        isPrimary: !hasPrimaryThisYear,
      },
    });
    return this.findOne(userId);
  }

  async unassignAccommodation(userId: string, assignmentId: string) {
    await this.assertHasRole(userId, 'ACCOMMODATION_MANAGER', 'مدیر اسکان یافت نشد');
    const link = await this.prisma.accommodationManager.findFirst({
      where: { id: assignmentId, userId },
    });
    if (!link) {
      throw new NotFoundException('این تخصیص یافت نشد');
    }
    await this.prisma.accommodationManager.delete({ where: { id: assignmentId } });
    return this.findOne(userId);
  }

  async unassignCity(userId: string, cityId: string) {
    await this.assertHasRole(userId, 'HEADQUARTERS_REPRESENTATIVE', 'نماینده ستاد یافت نشد');
    const city = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!city || city.representativeId !== userId) {
      throw new NotFoundException('این شهر به این نماینده اختصاص داده نشده است');
    }
    await this.prisma.city.update({
      where: { id: cityId },
      data: { representativeId: null },
    });
    return this.findOne(userId);
  }

  private async ensureExistingRole(roleCode: string) {
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) {
      throw new BadRequestException('نقش انتخاب‌شده معتبر نیست');
    }
    return role;
  }

  private listWhere(query: FindUsersQueryDto): Prisma.UserWhereInput {
    const filters: Prisma.UserWhereInput[] = [];
    const roleCodes = query.roleCodes?.length
      ? query.roleCodes
      : query.roleCode
        ? [query.roleCode]
        : [];
    if (roleCodes.length) {
      filters.push({
        userRoles: { some: { role: { code: { in: roleCodes } } } },
      });
    }
    if (query.provinceId) {
      filters.push({
        OR: [
          { representedProvinces: { some: { id: query.provinceId } } },
          { representedCities: { some: { provinceId: query.provinceId } } },
        ],
      });
    }
    if (query.cityId) {
      filters.push({
        OR: [
          {
            representedCities: {
              some: {
                id: query.cityId,
                province: { representativeId: { not: null } },
              },
            },
          },
          {
            representedProvinces: {
              some: {
                cities: { some: { id: query.cityId, representativeId: null } },
              },
            },
          },
        ],
      });
    }
    if (query.q) {
      const nameMatch = containsInsensitive(query.q);
      const geoName = {
        OR: [{ nameFa: nameMatch }, { nameEn: nameMatch }],
      };
      filters.push({
        OR: [
          { username: containsInsensitive(query.q) },
          { firstName: containsInsensitive(query.q) },
          { lastName: containsInsensitive(query.q) },
          { fullName: containsInsensitive(query.q) },
          { nationalId: containsInsensitive(query.q) },
          { phone: containsInsensitive(query.q) },
          { email: containsInsensitive(query.q) },
          { address: containsInsensitive(query.q) },
          { notes: containsInsensitive(query.q) },
          { telegram: containsInsensitive(query.q) },
          { bale: containsInsensitive(query.q) },
          { eitaa: containsInsensitive(query.q) },
          { whatsapp: containsInsensitive(query.q) },
          { otherSocial: containsInsensitive(query.q) },
          {
            userRoles: {
              some: {
                role: {
                  OR: [
                    { nameKey: containsInsensitive(query.q) },
                    { code: containsInsensitive(query.q) },
                  ],
                },
              },
            },
          },
          { representedProvinces: { some: geoName } },
          {
            representedCities: {
              some: {
                ...geoName,
                province: { representativeId: { not: null } },
              },
            },
          },
          {
            representedProvinces: {
              some: {
                cities: { some: { representativeId: null, ...geoName } },
              },
            },
          },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private toUserData(
    dto: CreateUserDto | UpdateUserDto,
    geo: { countryId: string | null; provinceId: string | null; cityId: string | null },
  ) {
    const firstName = dto.firstName?.trim()
    const lastName = dto.lastName?.trim()
    const fullName =
      firstName != null && lastName != null
        ? joinFullName(firstName, lastName)
        : undefined
    const data: Record<string, unknown> = {
      countryId: geo.countryId,
      provinceId: geo.provinceId,
      cityId: geo.cityId,
    }

    const set = (key: string, value: unknown) => {
      if (value !== undefined) {
        (data as Record<string, unknown>)[key] = value;
      }
    };

    set('firstName', firstName);
    set('lastName', lastName);
    set('fullName', fullName);
    set('status', dto.status);
    set('gender', dto.gender);
    set('nationalId', dto.nationalId);
    set('phone', dto.phone);
    set('email', dto.email);
    set('address', dto.address);
    set('notes', dto.notes);
    set('religion', dto.religion);
    if (dto.religion !== undefined && dto.religion !== Religion.OTHER) {
      set('religionOther', null);
    } else {
      set('religionOther', dto.religionOther);
    }
    set('telegram', dto.telegram);
    set('bale', dto.bale);
    set('eitaa', dto.eitaa);
    set('whatsapp', dto.whatsapp);
    set('otherSocial', dto.otherSocial);
    set('vehiclePlates', cleanPlates(dto.vehiclePlates));
    set('photoId', dto.photoId);
    set('nationalCardPhotoId', dto.nationalCardPhotoId);
    set('passportPhotoId', dto.passportPhotoId);

    return data;
  }

  private toPublicUser(user: PublicUserSource, withAccommodations = false) {
    const primary = user.managedAccommodations.find((item) => item.isPrimary);
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      locale: user.locale,
      status: user.status,
      gender: user.gender,
      nationalId: user.nationalId,
      phone: user.phone,
      email: user.email,
      address: user.address,
      notes: user.notes,
      religion: user.religion,
      religionOther: user.religionOther,
      telegram: user.telegram,
      bale: user.bale,
      eitaa: user.eitaa,
      whatsapp: user.whatsapp,
      otherSocial: user.otherSocial,
      vehiclePlates: user.vehiclePlates,
      countryId: user.countryId,
      provinceId: user.provinceId,
      cityId: user.cityId,
      country: user.country,
      province: user.province,
      city: user.city,
      photoId: user.photoId,
      nationalCardPhotoId: user.nationalCardPhotoId,
      passportPhotoId: user.passportPhotoId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.userRoles.map((item) => item.role),
      accommodationCount: user._count.managedAccommodations,
      representedProvinceCount: user._count.representedProvinces,
      representedCityCount: user._count.representedCities,
      representedProvinces: user.representedProvinces,
      representedCities: user.representedCities,
      primaryAccommodation: primary?.accommodation ?? null,
      accommodations: withAccommodations
        ? user.managedAccommodations.map((item) => ({
            id: item.id,
            year: item.year,
            isPrimary: item.isPrimary,
            createdAt: item.createdAt,
            accommodation: item.accommodation,
          }))
        : undefined,
    };
  }

  private async resolveGeo(dto: {
    countryId?: string | null;
    provinceId?: string | null;
    cityId?: string | null;
  }) {
    if (dto.cityId) {
      const city = await this.prisma.city.findUnique({
        where: { id: dto.cityId },
        include: { province: true },
      });
      if (!city) {
        throw new BadRequestException('شهر انتخاب‌شده معتبر نیست');
      }
      return {
        cityId: city.id,
        provinceId: city.provinceId,
        countryId: city.province.countryId,
      };
    }
    if (dto.provinceId) {
      const province = await this.prisma.province.findUnique({
        where: { id: dto.provinceId },
      });
      if (!province) {
        throw new BadRequestException('استان انتخاب‌شده معتبر نیست');
      }
      return {
        cityId: null,
        provinceId: province.id,
        countryId: province.countryId,
      };
    }
    if (dto.countryId) {
      const country = await this.prisma.country.findUnique({
        where: { id: dto.countryId },
      });
      if (!country) {
        throw new BadRequestException('کشور انتخاب‌شده معتبر نیست');
      }
      return { cityId: null, provinceId: null, countryId: country.id };
    }
    return {
      cityId: dto.cityId ?? null,
      provinceId: dto.provinceId ?? null,
      countryId: dto.countryId ?? null,
    };
  }

  private async assertImages(dto: CreateUserDto | UpdateUserDto) {
    const ids = [dto.photoId, dto.nationalCardPhotoId, dto.passportPhotoId].filter(
      (id): id is string => Boolean(id),
    );
    if (!ids.length) {
      return;
    }
    const images = await this.prisma.storedImage.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (images.length !== [...new Set(ids)].length) {
      throw new BadRequestException('تصویر انتخاب‌شده معتبر نیست');
    }
  }

  private async assertRolesExist(roleIds: string[]) {
    const uniqueIds = [...new Set(roleIds)];
    const roles = await this.prisma.role.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (roles.length !== uniqueIds.length) {
      throw new BadRequestException('نقش انتخاب‌شده معتبر نیست');
    }
    return uniqueIds;
  }

  private async assertNotLastAdmin(
    current: { roles: { id: string; code: string }[] },
    nextRoleIds?: string[],
  ) {
    if (!isAdmin(current)) {
      return;
    }

    if (nextRoleIds) {
      const nextRoles = await this.prisma.role.findMany({
        where: { id: { in: nextRoleIds } },
        select: { code: true },
      });
      if (nextRoles.some((role) => role.code === 'ADMIN')) {
        return;
      }
    }

    const adminCount = await this.prisma.user.count({
      where: { userRoles: { some: { role: { code: 'ADMIN' } } } },
    });
    if (adminCount <= 1) {
      throw new BadRequestException(
        'نمی‌توان آخرین مدیر سامانه را حذف یا تغییر نقش داد',
      );
    }
  }

  private rethrowUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target.join(' ') : String(target ?? '');
      if (fields.includes('nationalId')) {
        throw new ConflictException('کد ملی تکراری است');
      }
      if (fields.includes('phone')) {
        throw new ConflictException('شماره تلفن تکراری است');
      }
      if (fields.includes('email')) {
        throw new ConflictException('ایمیل تکراری است');
      }
      throw new ConflictException('نام کاربری تکراری است');
    }
    throw error;
  }
}
