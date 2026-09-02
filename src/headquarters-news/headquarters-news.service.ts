import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { parseIsoDate, toIsoDateOnly, todayIsoDateTehran } from '../common/iso-date';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import { getRequestLocale } from '../common/request-locale';
import { resolveSortOrder } from '../common/sort-query';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateHeadquartersNewsDto,
  HeadquartersNewsTranslationDto,
} from './dto/create-headquarters-news.dto';
import { FindHeadquartersNewsQueryDto } from './dto/find-headquarters-news-query.dto';
import { UpdateHeadquartersNewsDto } from './dto/update-headquarters-news.dto';
import {
  newsSourceLocale,
  newsTranslationLocales,
  type NewsTranslationLocale,
} from './news-locales';

const newsInclude = {
  translations: { orderBy: { locale: 'asc' as const } },
} satisfies Prisma.HeadquartersNewsInclude;

type NewsRecord = Prisma.HeadquartersNewsGetPayload<{
  include: typeof newsInclude;
}>;

type NormalizedTranslation = {
  locale: NewsTranslationLocale;
  title: string;
  summary: string | null;
  body: string;
};

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
        include: newsInclude,
      });
      return items.map((item) => this.serializeAdmin(item));
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.headquartersNews.findMany({
        where,
        orderBy,
        skip,
        take,
        include: newsInclude,
      }),
      this.prisma.headquartersNews.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serializeAdmin(item)),
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
      include: newsInclude,
    });
    return items.map((item) => this.serializePublic(item));
  }

  async findPublishedOne(id: string) {
    const item = await this.prisma.headquartersNews.findFirst({
      where: { id, isPublished: true },
      include: newsInclude,
    });
    if (!item) {
      throw new NotFoundException('خبر یافت نشد');
    }
    return this.serializePublic(item);
  }

  async findOne(id: string) {
    const item = await this.prisma.headquartersNews.findUnique({
      where: { id },
      include: newsInclude,
    });
    if (!item) {
      throw new NotFoundException('خبر یافت نشد');
    }
    return this.serializeAdmin(item);
  }

  async create(dto: CreateHeadquartersNewsDto) {
    await this.assertImage(dto.imageId);
    const translations = this.normalizeTranslations(dto.translations);
    const item = await this.prisma.headquartersNews.create({
      data: {
        title: dto.title.trim(),
        summary: dto.summary?.trim() || null,
        body: dto.body.trim(),
        publishedAt: parseIsoDate(dto.publishedAt || todayIsoDateTehran()),
        isPublished: dto.isPublished ?? true,
        imageId: dto.imageId || null,
        translations: translations.length
          ? { create: translations }
          : undefined,
      },
      include: newsInclude,
    });
    return this.serializeAdmin(item);
  }

  async update(id: string, dto: UpdateHeadquartersNewsDto) {
    await this.findOne(id);
    if (dto.imageId !== undefined) {
      await this.assertImage(dto.imageId);
    }
    const translations =
      dto.translations === undefined
        ? undefined
        : this.normalizeTranslations(dto.translations);
    const item = await this.prisma.$transaction(async (tx) => {
      if (translations) {
        await tx.headquartersNewsTranslation.deleteMany({ where: { newsId: id } });
        if (translations.length) {
          await tx.headquartersNewsTranslation.createMany({
            data: translations.map((row) => ({ ...row, newsId: id })),
          });
        }
      }
      return tx.headquartersNews.update({
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
          imageId:
            dto.imageId === undefined ? undefined : dto.imageId || null,
        },
        include: newsInclude,
      });
    });
    return this.serializeAdmin(item);
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
          {
            translations: {
              some: {
                OR: [
                  { title: containsInsensitive(query.q) },
                  { summary: containsInsensitive(query.q) },
                  { body: containsInsensitive(query.q) },
                ],
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

  private normalizeTranslations(
    items?: HeadquartersNewsTranslationDto[],
  ): NormalizedTranslation[] {
    if (!items?.length) {
      return [];
    }
    const byLocale = new Map<NewsTranslationLocale, NormalizedTranslation>();
    for (const item of items) {
      if (!newsTranslationLocales.includes(item.locale)) {
        continue;
      }
      const title = item.title?.trim() ?? '';
      const summary = item.summary?.trim() || null;
      const body = item.body?.trim() ?? '';
      if (!title && !summary && !body) {
        continue;
      }
      if (title.length < 2 || body.length < 2) {
        throw new BadRequestException(
          'ترجمه ناقص است؛ عنوان و متن را کامل کنید یا این زبان را خالی بگذارید',
        );
      }
      byLocale.set(item.locale, {
        locale: item.locale,
        title,
        summary,
        body,
      });
    }
    return [...byLocale.values()];
  }

  private pickLocalized(item: NewsRecord) {
    const locale = getRequestLocale();
    const persian = {
      title: item.title,
      summary: item.summary,
      body: item.body,
      contentLocale: newsSourceLocale,
    };
    if (locale === newsSourceLocale) {
      return persian;
    }
    const translation = item.translations.find((row) => row.locale === locale);
    if (!translation?.title?.trim() || !translation.body?.trim()) {
      return persian;
    }
    return {
      title: translation.title,
      summary: translation.summary || item.summary,
      body: translation.body,
      contentLocale: locale,
    };
  }

  private async assertImage(imageId?: string | null) {
    if (!imageId) {
      return;
    }
    const image = await this.prisma.storedImage.findUnique({
      where: { id: imageId },
      select: { id: true },
    });
    if (!image) {
      throw new BadRequestException('تصویر انتخاب‌شده معتبر نیست');
    }
  }

  private serializeAdmin(item: NewsRecord) {
    return {
      id: item.id,
      title: item.title,
      summary: item.summary,
      body: item.body,
      publishedAt: toIsoDateOnly(item.publishedAt),
      isPublished: item.isPublished,
      imageId: item.imageId,
      translations: item.translations.map((row) => ({
        locale: row.locale,
        title: row.title,
        summary: row.summary,
        body: row.body,
      })),
      translatedLocales: item.translations.map((row) => row.locale),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private serializePublic(item: NewsRecord) {
    const localized = this.pickLocalized(item);
    return {
      id: item.id,
      title: localized.title,
      summary: localized.summary,
      body: localized.body,
      contentLocale: localized.contentLocale,
      publishedAt: toIsoDateOnly(item.publishedAt),
      isPublished: item.isPublished,
      imageId: item.imageId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
