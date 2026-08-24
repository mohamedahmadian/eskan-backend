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

@Injectable()
export class GovernmentOrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindGovernmentOrganizationsQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      return this.prisma.governmentOrganization.findMany({ where, orderBy });
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.governmentOrganization.findMany({
        where,
        orderBy,
        skip,
        take,
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
        contactPerson: (dir) => ({ contactPerson: dir }),
        mobile: (dir) => ({ mobile: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  async findOne(id: string) {
    const item = await this.prisma.governmentOrganization.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException('سازمان یافت نشد');
    }
    return item;
  }

  create(dto: CreateGovernmentOrganizationDto) {
    return this.prisma.governmentOrganization.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        contactPerson: dto.contactPerson?.trim() || null,
        mobile: dto.mobile?.trim() || null,
        description: dto.description?.trim() || null,
      },
    });
  }

  async update(id: string, dto: UpdateGovernmentOrganizationDto) {
    await this.findOne(id);
    return this.prisma.governmentOrganization.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone === undefined ? undefined : dto.phone?.trim() || null,
        address:
          dto.address === undefined ? undefined : dto.address?.trim() || null,
        contactPerson:
          dto.contactPerson === undefined
            ? undefined
            : dto.contactPerson?.trim() || null,
        mobile:
          dto.mobile === undefined ? undefined : dto.mobile?.trim() || null,
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
      },
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
        { contactPerson: containsInsensitive(query.q) },
        { mobile: containsInsensitive(query.q) },
        { description: containsInsensitive(query.q) },
      ],
    };
  }
}
