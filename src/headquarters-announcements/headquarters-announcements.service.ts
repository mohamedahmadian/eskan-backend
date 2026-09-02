import { Injectable, NotFoundException } from '@nestjs/common';
import { parseIsoDate, toIsoDateOnly, todayIsoDateTehran } from '../common/iso-date';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import { HeadquartersAnnouncement, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHeadquartersAnnouncementDto } from './dto/create-headquarters-announcement.dto';
import { FindHeadquartersAnnouncementsQueryDto } from './dto/find-headquarters-announcements-query.dto';
import { UpdateHeadquartersAnnouncementDto } from './dto/update-headquarters-announcement.dto';

type AnnouncementRecord = HeadquartersAnnouncement;

@Injectable()
export class HeadquartersAnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindHeadquartersAnnouncementsQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      const items = await this.prisma.headquartersAnnouncement.findMany({
        where,
        orderBy,
      });
      return items.map((item) => this.serialize(item));
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.headquartersAnnouncement.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      this.prisma.headquartersAnnouncement.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async findPublished(audience?: AnnouncementRecord['audience']) {
    const items = await this.prisma.headquartersAnnouncement.findMany({
      where: {
        isPublished: true,
        ...(audience ? { audience } : {}),
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
      take: 12,
    });
    return items.map((item) => this.serialize(item));
  }

  async findPublishedOne(id: string) {
    const item = await this.prisma.headquartersAnnouncement.findFirst({
      where: { id, isPublished: true },
    });
    if (!item) {
      throw new NotFoundException('اطلاعیه یافت نشد');
    }
    return this.serialize(item);
  }

  async findOne(id: string) {
    const item = await this.prisma.headquartersAnnouncement.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException('اطلاعیه یافت نشد');
    }
    return this.serialize(item);
  }

  async create(dto: CreateHeadquartersAnnouncementDto) {
    const item = await this.prisma.headquartersAnnouncement.create({
      data: {
        title: dto.title.trim(),
        body: dto.body.trim(),
        audience: dto.audience,
        publishedAt: parseIsoDate(dto.publishedAt || todayIsoDateTehran()),
        isPublished: dto.isPublished ?? true,
      },
    });
    return this.serialize(item);
  }

  async update(id: string, dto: UpdateHeadquartersAnnouncementDto) {
    await this.findOne(id);
    const item = await this.prisma.headquartersAnnouncement.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        body: dto.body?.trim(),
        audience: dto.audience,
        publishedAt:
          dto.publishedAt === undefined
            ? undefined
            : parseIsoDate(dto.publishedAt),
        isPublished: dto.isPublished,
      },
    });
    return this.serialize(item);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.headquartersAnnouncement.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(
    query: FindHeadquartersAnnouncementsQueryDto,
  ): Prisma.HeadquartersAnnouncementWhereInput {
    const filters: Prisma.HeadquartersAnnouncementWhereInput[] = [];
    if (query.audience) {
      filters.push({ audience: query.audience });
    }
    if (query.isPublished !== undefined) {
      filters.push({ isPublished: query.isPublished });
    }
    if (query.q) {
      filters.push({
        OR: [
          { title: containsInsensitive(query.q) },
          { body: containsInsensitive(query.q) },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private listOrderBy(
    query: FindHeadquartersAnnouncementsQueryDto,
  ): Prisma.HeadquartersAnnouncementOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.HeadquartersAnnouncementOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        title: (dir) => ({ title: dir }),
        audience: (dir) => ({ audience: dir }),
        publishedAt: (dir) => ({ publishedAt: dir }),
        isPublished: (dir) => ({ isPublished: dir }),
        createdAt: (dir) => ({ createdAt: dir }),
      },
      [{ publishedAt: 'desc' }, { id: 'asc' }],
    );
  }

  private serialize(item: AnnouncementRecord) {
    return {
      id: item.id,
      title: item.title,
      body: item.body,
      audience: item.audience,
      publishedAt: toIsoDateOnly(item.publishedAt),
      isPublished: item.isPublished,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
