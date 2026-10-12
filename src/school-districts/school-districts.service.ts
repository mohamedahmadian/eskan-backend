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
import { CreateSchoolDistrictDto } from './dto/create-school-district.dto';
import { FindSchoolDistrictsQueryDto } from './dto/find-school-districts-query.dto';
import { UpdateSchoolDistrictDto } from './dto/update-school-district.dto';

@Injectable()
export class SchoolDistrictsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindSchoolDistrictsQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      return this.prisma.schoolDistrict.findMany({ where, orderBy });
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.schoolDistrict.findMany({ where, orderBy, skip, take }),
      this.prisma.schoolDistrict.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  async findOne(id: string) {
    const item = await this.prisma.schoolDistrict.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('ناحیه یافت نشد');
    }
    return item;
  }

  async create(dto: CreateSchoolDistrictDto) {
    return this.prisma.schoolDistrict.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
      },
    });
  }

  async update(id: string, dto: UpdateSchoolDistrictDto) {
    await this.findOne(id);
    return this.prisma.schoolDistrict.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description:
          dto.description === undefined ? undefined : dto.description?.trim() || null,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    const used = await this.prisma.accommodation.count({
      where: { schoolDistrictId: id },
    });
    if (used > 0) {
      throw new BadRequestException(
        'این ناحیه در اسکان‌ها استفاده شده و قابل حذف نیست',
      );
    }
    await this.prisma.schoolDistrict.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(
    query: FindSchoolDistrictsQueryDto,
  ): Prisma.SchoolDistrictWhereInput {
    if (!query.q) return {};
    return {
      OR: [
        { name: containsInsensitive(query.q) },
        { description: containsInsensitive(query.q) },
      ],
    };
  }

  private listOrderBy(
    query: FindSchoolDistrictsQueryDto,
  ): Prisma.SchoolDistrictOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.SchoolDistrictOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        description: (dir) => ({ description: dir }),
        createdAt: (dir) => ({ createdAt: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }
}
