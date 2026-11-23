import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  contentSourceLocale,
  contentTranslationLocales,
  type ContentTranslationLocale,
} from '../common/content-locales';
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
  CreateHeadquartersAnnouncementDto,
  HeadquartersAnnouncementTranslationDto,
} from './dto/create-headquarters-announcement.dto';
import { FindHeadquartersAnnouncementsQueryDto } from './dto/find-headquarters-announcements-query.dto';
import { UpdateHeadquartersAnnouncementDto } from './dto/update-headquarters-announcement.dto';

const announcementInclude = {
  translations: { orderBy: { locale: 'asc' as const } },
} satisfies Prisma.HeadquartersAnnouncementInclude;

type AnnouncementRecord = Prisma.HeadquartersAnnouncementGetPayload<{
  include: typeof announcementInclude;
}>;

type NormalizedTranslation = {
  locale: ContentTranslationLocale;
  title: string;
  body: string;
};

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
        include: announcementInclude,
      });
      return items.map((item) => this.serializeAdmin(item));
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.headquartersAnnouncement.findMany({
        where,
        orderBy,
        skip,
        take,
        include: announcementInclude,
      }),
      this.prisma.headquartersAnnouncement.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serializeAdmin(item)),
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
      include: announcementInclude,
    });
    return items.map((item) => this.serializePublic(item));
  }

  async findPublishedOne(id: string) {
    const item = await this.prisma.headquartersAnnouncement.findFirst({
      where: { id, isPublished: true },
      include: announcementInclude,
    });
    if (!item) {
      throw new NotFoundException('اطلاعیه یافت نشد');
    }
    return this.serializePublic(item);
  }

  async findOne(id: string) {
    const item = await this.prisma.headquartersAnnouncement.findUnique({
      where: { id },
      include: announcementInclude,
    });
    if (!item) {
      throw new NotFoundException('اطلاعیه یافت نشد');
    }
    return this.serializeAdmin(item);
  }

  async create(dto: CreateHeadquartersAnnouncementDto) {
    const translations = this.normalizeTranslations(dto.translations);
    const item = await this.prisma.headquartersAnnouncement.create({
      data: {
        title: dto.title.trim(),
        body: dto.body.trim(),
        audience: dto.audience,
        publishedAt: parseIsoDate(dto.publishedAt || todayIsoDateTehran()),
        isPublished: dto.isPublished ?? true,
        translations: translations.length
          ? { create: translations }
          : undefined,
      },
      include: announcementInclude,
    });
    return this.serializeAdmin(item);
  }

  async update(id: string, dto: UpdateHeadquartersAnnouncementDto) {
    await this.findOne(id);
    const translations =
      dto.translations === undefined
        ? undefined
        : this.normalizeTranslations(dto.translations);
    const item = await this.prisma.$transaction(async (tx) => {
      if (translations) {
        await tx.headquartersAnnouncementTranslation.deleteMany({
          where: { announcementId: id },
        });
        if (translations.length) {
          await tx.headquartersAnnouncementTranslation.createMany({
            data: translations.map((row) => ({ ...row, announcementId: id })),
          });
        }
      }
      return tx.headquartersAnnouncement.update({
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
        include: announcementInclude,
      });
    });
    return this.serializeAdmin(item);
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
          {
            translations: {
              some: {
                OR: [
                  { title: containsInsensitive(query.q) },
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

  private normalizeTranslations(
    items?: HeadquartersAnnouncementTranslationDto[],
  ): NormalizedTranslation[] {
    if (!items?.length) {
      return [];
    }
    const byLocale = new Map<ContentTranslationLocale, NormalizedTranslation>();
    for (const item of items) {
      if (!contentTranslationLocales.includes(item.locale)) {
        continue;
      }
      const title = item.title?.trim() ?? '';
      const body = item.body?.trim() ?? '';
      if (!title && !body) {
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
        body,
      });
    }
    return [...byLocale.values()];
  }

  private pickLocalized(item: AnnouncementRecord) {
    const locale = getRequestLocale();
    const persian = {
      title: item.title,
      body: item.body,
      contentLocale: contentSourceLocale,
    };
    if (locale === contentSourceLocale) {
      return persian;
    }
    const translation = item.translations.find((row) => row.locale === locale);
    if (!translation?.title?.trim() || !translation.body?.trim()) {
      return persian;
    }
    return {
      title: translation.title,
      body: translation.body,
      contentLocale: locale,
    };
  }

  private serializeAdmin(item: AnnouncementRecord) {
    return {
      id: item.id,
      title: item.title,
      body: item.body,
      audience: item.audience,
      publishedAt: toIsoDateOnly(item.publishedAt),
      isPublished: item.isPublished,
      translations: item.translations.map((row) => ({
        locale: row.locale,
        title: row.title,
        body: row.body,
      })),
      translatedLocales: item.translations.map((row) => row.locale),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private serializePublic(item: AnnouncementRecord) {
    const localized = this.pickLocalized(item);
    return {
      id: item.id,
      title: localized.title,
      body: localized.body,
      contentLocale: localized.contentLocale,
      audience: item.audience,
      publishedAt: toIsoDateOnly(item.publishedAt),
      isPublished: item.isPublished,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
