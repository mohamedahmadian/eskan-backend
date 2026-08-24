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
import { CreateGroupDto } from './dto/create-group.dto';
import { FindGroupsQueryDto } from './dto/find-groups-query.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

const groupInclude = {
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
      status: true,
    },
  },
} satisfies Prisma.GroupInclude;

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async findAll(query: FindGroupsQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    const [items, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        include: groupInclude,
        orderBy,
        skip,
        take,
      }),
      this.prisma.group.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  async findMine(query: FindGroupsQueryDto, managerUserId: string) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const searchWhere = this.listWhere(query);
    const where: Prisma.GroupWhereInput = {
      managerUserId,
      ...(searchWhere ? searchWhere : {}),
    };
    const orderBy = this.listOrderBy(query);
    const [items, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        include: groupInclude,
        orderBy,
        skip,
        take,
      }),
      this.prisma.group.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  private listOrderBy(
    query: FindGroupsQueryDto,
  ): Prisma.GroupOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.GroupOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        city: (dir) => ({ city: { nameFa: dir } }),
        manager: (dir) => ({ manager: { fullName: dir } }),
        maleCount: (dir) => ({ maleCount: dir }),
        femaleCount: (dir) => ({ femaleCount: dir }),
        totalCount: (dir) => ({ totalCount: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  async findOne(id: string, actor?: RoleBearer & { id: string }) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: groupInclude,
    });
    if (!group) {
      throw new NotFoundException('گروه یافت نشد');
    }
    if (actor && !isAdmin(actor) && group.managerUserId !== actor.id) {
      throw new ForbiddenException('امکان مشاهده این گروه وجود ندارد');
    }
    return group;
  }

  private listWhere(query: FindGroupsQueryDto): Prisma.GroupWhereInput | undefined {
    if (!query.q) return undefined;
    return {
      OR: [
        { name: containsInsensitive(query.q) },
        { manager: { fullName: containsInsensitive(query.q) } },
        { manager: { nationalId: containsInsensitive(query.q) } },
        { manager: { phone: containsInsensitive(query.q) } },
        { city: { nameFa: containsInsensitive(query.q) } },
        { city: { nameEn: containsInsensitive(query.q) } },
        { city: { province: { nameFa: containsInsensitive(query.q) } } },
        { city: { province: { country: { nameFa: containsInsensitive(query.q) } } } },
        { eitaa: containsInsensitive(query.q) },
        { bale: containsInsensitive(query.q) },
        { telegram: containsInsensitive(query.q) },
        { instagram: containsInsensitive(query.q) },
      ],
    };
  }

  async create(dto: CreateGroupDto, actor: RoleBearer & { id: string }) {
    const cityId = await this.resolveCityId(dto.cityId, actor.id);
    await this.users.ensureRole(actor.id, 'GROUP_MANAGER');

    return this.prisma.group.create({
      data: {
        name: dto.name.trim(),
        cityId,
        managerUserId: actor.id,
        maleCount: dto.maleCount ?? 0,
        femaleCount: dto.femaleCount ?? 0,
        totalCount: (dto.maleCount ?? 0) + (dto.femaleCount ?? 0),
        eitaa: dto.eitaa?.trim() || null,
        bale: dto.bale?.trim() || null,
        telegram: dto.telegram?.trim() || null,
        instagram: dto.instagram?.trim() || null,
      },
      include: groupInclude,
    });
  }

  async update(
    id: string,
    dto: UpdateGroupDto,
    actor: RoleBearer & { id: string },
  ) {
    const current = await this.findOne(id, actor);
    if (dto.cityId) {
      await this.assertCity(dto.cityId);
    }

    const maleCount =
      dto.maleCount !== undefined ? dto.maleCount : current.maleCount;
    const femaleCount =
      dto.femaleCount !== undefined ? dto.femaleCount : current.femaleCount;
    const countsChanged =
      dto.maleCount !== undefined || dto.femaleCount !== undefined;

    return this.prisma.group.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        cityId: dto.cityId,
        maleCount: dto.maleCount,
        femaleCount: dto.femaleCount,
        totalCount: countsChanged ? maleCount + femaleCount : undefined,
        eitaa: dto.eitaa === undefined ? undefined : dto.eitaa?.trim() || null,
        bale: dto.bale === undefined ? undefined : dto.bale?.trim() || null,
        telegram:
          dto.telegram === undefined ? undefined : dto.telegram?.trim() || null,
        instagram:
          dto.instagram === undefined ? undefined : dto.instagram?.trim() || null,
      },
      include: groupInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.group.delete({ where: { id } });
    return { ok: true };
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
}
