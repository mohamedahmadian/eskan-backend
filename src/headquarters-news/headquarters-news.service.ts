import { Injectable, NotFoundException } from '@nestjs/common';
import { parseIsoDate, toIsoDateOnly, todayIsoDateTehran } from '../common/iso-date';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import { HeadquartersNews, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHeadquartersNewsDto } from './dto/create-headquarters-news.dto';
import { FindHeadquartersNewsQueryDto } from './dto/find-headquarters-news-query.dto';
import { UpdateHeadquartersNewsDto } from './dto/update-headquarters-news.dto';

type NewsRecord = HeadquartersNews;

@Injectable()
export class HeadquartersNewsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindHeadquartersNewsQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      const items = await this.prisma.headquartersNews.findMany({
        where,
        orderBy,
      });
      return items.map((item) => this.serialize(item));
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.headquartersNews.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      this.prisma.headquartersNews.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async findPublished(limit = 4) {
    const items = await this.prisma.headquartersNews.findMany({
      where: { isPublished: true },
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
      take: limit,
    });
    return items.map((item) => this.serialize(item));
  }

  async findPublishedOne(id: string) {
    const item = await this.prisma.headquartersNews.findFirst({
      where: { id, isPublished: true },
    });
    if (!item) {
      throw new NotFoundException('خبر یافت نشد');
    }
    return this.serialize(item);
  }

  async findOne(id: string) {
    const item = await this.prisma.headquartersNews.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException('خبر یافت نشد');
    }
    return this.serialize(item);
  }

  async create(dto: CreateHeadquartersNewsDto) {
    const item = await this.prisma.headquartersNews.create({
      data: {
        title: dto.title.trim(),
        summary: dto.summary?.trim() || null,
        body: dto.body.trim(),
        publishedAt: parseIsoDate(dto.publishedAt || todayIsoDateTehran()),
        isPublished: dto.isPublished ?? true,
      },
    });
    return this.serialize(item);
  }

  async update(id: string, dto: UpdateHeadquartersNewsDto) {
    await this.findOne(id);
    const item = await this.prisma.headquartersNews.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        summary:
          dto.summary === undefined ? undefined : dto.summary?.trim() || null,
        body: dto.body?.trim(),
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
    await this.prisma.headquartersNews.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(
    query: FindHeadquartersNewsQueryDto,
  ): Prisma.HeadquartersNewsWhereInput {
    const filters: Prisma.HeadquartersNewsWhereInput[] = [];
    if (query.isPublished !== undefined) {
      filters.push({ isPublished: query.isPublished });
    }
    if (query.q) {
      filters.push({
        OR: [
          { title: containsInsensitive(query.q) },
          { summary: containsInsensitive(query.q) },
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
    query: FindHeadquartersNewsQueryDto,
  ): Prisma.HeadquartersNewsOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.HeadquartersNewsOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        title: (dir) => ({ title: dir }),
        publishedAt: (dir) => ({ publishedAt: dir }),
        isPublished: (dir) => ({ isPublished: dir }),
        createdAt: (dir) => ({ createdAt: dir }),
      },
      [{ publishedAt: 'desc' }, { id: 'asc' }],
    );
  }

  private serialize(item: NewsRecord) {
    return {
      id: item.id,
      title: item.title,
      summary: item.summary,
      body: item.body,
      publishedAt: toIsoDateOnly(item.publishedAt),
      isPublished: item.isPublished,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
