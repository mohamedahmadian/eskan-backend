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
import { resolveSortOrder } from '../common/sort-query';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhone } from '../common/phone';
import { CreateHeadquartersPhoneDto } from './dto/create-headquarters-phone.dto';
import { FindHeadquartersPhonesQueryDto } from './dto/find-headquarters-phones-query.dto';
import { UpdateHeadquartersPhoneDto } from './dto/update-headquarters-phone.dto';

const headquartersPhoneInclude = {
  headquarters: { select: { id: true, name: true } },
} satisfies Prisma.HeadquartersPhoneInclude;

type HeadquartersPhoneRecord = Prisma.HeadquartersPhoneGetPayload<{
  include: typeof headquartersPhoneInclude;
}>;

@Injectable()
export class HeadquartersPhonesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindHeadquartersPhonesQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    const [items, total] = await Promise.all([
      this.prisma.headquartersPhone.findMany({
        where,
        orderBy,
        skip,
        take,
        include: headquartersPhoneInclude,
      }),
      this.prisma.headquartersPhone.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.headquartersPhone.findUnique({
      where: { id },
      include: headquartersPhoneInclude,
    });
    if (!item) {
      throw new NotFoundException('تلفن ستاد یافت نشد');
    }
    return this.serialize(item);
  }

  async create(dto: CreateHeadquartersPhoneDto) {
    await this.ensureHeadquarters(dto.headquartersId);
    const item = await this.prisma.headquartersPhone.create({
      data: {
        headquartersId: dto.headquartersId,
        phone: normalizePhone(dto.phone),
        department: dto.department?.trim() || null,
        description: dto.description?.trim() || null,
      },
      include: headquartersPhoneInclude,
    });
    return this.serialize(item);
  }

  async update(id: string, dto: UpdateHeadquartersPhoneDto) {
    const current = await this.findOne(id);
    if (dto.headquartersId && dto.headquartersId !== current.headquartersId) {
      await this.ensureHeadquarters(dto.headquartersId);
    }
    const item = await this.prisma.headquartersPhone.update({
      where: { id },
      data: {
        headquartersId: dto.headquartersId,
        phone: dto.phone === undefined ? undefined : normalizePhone(dto.phone),
        department:
          dto.department === undefined
            ? undefined
            : dto.department?.trim() || null,
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
      },
      include: headquartersPhoneInclude,
    });
    return this.serialize(item);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.headquartersPhone.delete({ where: { id } });
    return { ok: true };
  }

  private listOrderBy(
    query: FindHeadquartersPhonesQueryDto,
  ): Prisma.HeadquartersPhoneOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.HeadquartersPhoneOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        phone: (dir) => ({ phone: dir }),
        department: (dir) => ({ department: dir }),
      },
      [{ createdAt: 'asc' }, { id: 'asc' }],
    );
  }

  private listWhere(
    query: FindHeadquartersPhonesQueryDto,
  ): Prisma.HeadquartersPhoneWhereInput {
    const filters: Prisma.HeadquartersPhoneWhereInput[] = [];
    if (query.headquartersId) {
      filters.push({ headquartersId: query.headquartersId });
    }
    if (query.q) {
      filters.push({
        OR: [
          { phone: containsInsensitive(query.q) },
          { department: containsInsensitive(query.q) },
          { description: containsInsensitive(query.q) },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private async ensureHeadquarters(headquartersId: string) {
    const headquarters = await this.prisma.headquartersInfo.findUnique({
      where: { id: headquartersId },
      select: { id: true },
    });
    if (!headquarters) {
      throw new BadRequestException('ستاد انتخاب‌شده معتبر نیست');
    }
  }

  private serialize(item: HeadquartersPhoneRecord) {
    return item;
  }
}
