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
import { CreateParticipationCampaignDto } from './dto/create-campaign.dto';
import { FindParticipationCampaignsQueryDto } from './dto/find-campaigns-query.dto';
import { UpdateParticipationCampaignDto } from './dto/update-campaign.dto';

const campaignInclude = {
  bankAccount: true,
  cryptoWallet: true,
  _count: { select: { participants: true } },
} satisfies Prisma.ParticipationCampaignInclude;

type CampaignRecord = Prisma.ParticipationCampaignGetPayload<{
  include: typeof campaignInclude;
}>;

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDateOnly(value: string) {
  const iso = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new BadRequestException('تاریخ معتبر نیست');
  }
  return new Date(`${iso}T00:00:00.000Z`);
}

function campaignStats(
  totalAmount: number,
  sharePrice: number,
  purchasedShares: number,
  participantCount: number,
) {
  const totalShares = sharePrice > 0 ? Math.floor(totalAmount / sharePrice) : 0;
  const remainingShares = Math.max(0, totalShares - purchasedShares);
  const progressPercent =
    totalShares > 0
      ? Math.min(100, Math.round((purchasedShares / totalShares) * 100))
      : 0;
  return {
    totalShares,
    purchasedShares,
    remainingShares,
    participantCount,
    progressPercent,
  };
}

@Injectable()
export class ParticipationCampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindParticipationCampaignsQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      const items = await this.prisma.participationCampaign.findMany({
        where,
        orderBy,
        include: campaignInclude,
      });
      return this.serializeMany(items);
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.participationCampaign.findMany({
        where,
        orderBy,
        skip,
        take,
        include: campaignInclude,
      }),
      this.prisma.participationCampaign.count({ where }),
    ]);
    return paginatedResult(await this.serializeMany(items), total, page, pageSize);
  }

  async showcase() {
    const items = await this.prisma.participationCampaign.findMany({
      where: { isActive: true },
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      include: campaignInclude,
    });
    return this.serializeMany(items);
  }

  async showcasePublic() {
    const items = await this.prisma.participationCampaign.findMany({
      where: { isActive: true },
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      take: 3,
      include: { _count: { select: { participants: true } } },
    });
    if (!items.length) {
      return [];
    }
    const ids = items.map((item) => item.id);
    const grouped = await this.prisma.campaignParticipant.groupBy({
      by: ['campaignId'],
      where: { campaignId: { in: ids } },
      _sum: { shareCount: true },
    });
    const purchasedById = new Map(
      grouped.map((row) => [row.campaignId, row._sum.shareCount ?? 0]),
    );
    return items.map((item) => {
      const stats = campaignStats(
        item.totalAmount,
        item.sharePrice,
        purchasedById.get(item.id) ?? 0,
        item._count.participants,
      );
      return {
        id: item.id,
        name: item.name,
        startDate: dateOnly(item.startDate),
        endDate: dateOnly(item.endDate),
        description: item.description,
        imageId: item.imageId,
        isActive: item.isActive,
        totalAmount: item.totalAmount,
        sharePrice: item.sharePrice,
        ...stats,
      };
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.participationCampaign.findUnique({
      where: { id },
      include: campaignInclude,
    });
    if (!item) {
      throw new NotFoundException('پویش یافت نشد');
    }
    const [serialized] = await this.serializeMany([item]);
    return serialized;
  }

  async create(dto: CreateParticipationCampaignDto) {
    this.assertAmounts(dto.totalAmount, dto.sharePrice);
    this.assertDates(dto.startDate, dto.endDate);
    await this.assertPaymentTargets(dto.bankAccountId, dto.cryptoWalletId);
    const item = await this.prisma.participationCampaign.create({
      data: {
        name: dto.name.trim(),
        startDate: parseDateOnly(dto.startDate),
        endDate: parseDateOnly(dto.endDate),
        description: dto.description?.trim() || null,
        imageId: dto.imageId || null,
        isActive: dto.isActive ?? true,
        totalAmount: dto.totalAmount,
        sharePrice: dto.sharePrice,
        bankAccountId: dto.bankAccountId || null,
        cryptoWalletId: dto.cryptoWalletId || null,
      },
      include: campaignInclude,
    });
    const [serialized] = await this.serializeMany([item]);
    return serialized;
  }

  async update(id: string, dto: UpdateParticipationCampaignDto) {
    const current = await this.findOne(id);
    const totalAmount = dto.totalAmount ?? current.totalAmount;
    const sharePrice = dto.sharePrice ?? current.sharePrice;
    const startDate = dto.startDate ?? current.startDate;
    const endDate = dto.endDate ?? current.endDate;
    const bankAccountId =
      dto.bankAccountId === undefined ? current.bankAccountId : dto.bankAccountId;
    const cryptoWalletId =
      dto.cryptoWalletId === undefined
        ? current.cryptoWalletId
        : dto.cryptoWalletId;
    this.assertAmounts(totalAmount, sharePrice);
    this.assertDates(startDate, endDate);
    await this.assertPaymentTargets(bankAccountId, cryptoWalletId);
    const item = await this.prisma.participationCampaign.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        startDate: dto.startDate ? parseDateOnly(dto.startDate) : undefined,
        endDate: dto.endDate ? parseDateOnly(dto.endDate) : undefined,
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        imageId: dto.imageId === undefined ? undefined : dto.imageId || null,
        isActive: dto.isActive,
        totalAmount: dto.totalAmount,
        sharePrice: dto.sharePrice,
        bankAccountId:
          dto.bankAccountId === undefined ? undefined : dto.bankAccountId || null,
        cryptoWalletId:
          dto.cryptoWalletId === undefined
            ? undefined
            : dto.cryptoWalletId || null,
      },
      include: campaignInclude,
    });
    const [serialized] = await this.serializeMany([item]);
    return serialized;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.participationCampaign.delete({ where: { id } });
    return { ok: true };
  }

  private async serializeMany(items: CampaignRecord[]) {
    if (!items.length) {
      return [];
    }
    const ids = items.map((item) => item.id);
    const grouped = await this.prisma.campaignParticipant.groupBy({
      by: ['campaignId'],
      where: { campaignId: { in: ids } },
      _sum: { shareCount: true },
    });
    const purchasedById = new Map(
      grouped.map((row) => [row.campaignId, row._sum.shareCount ?? 0]),
    );
    return items.map((item) => {
      const stats = campaignStats(
        item.totalAmount,
        item.sharePrice,
        purchasedById.get(item.id) ?? 0,
        item._count.participants,
      );
      return {
        ...item,
        startDate: dateOnly(item.startDate),
        endDate: dateOnly(item.endDate),
        ...stats,
      };
    });
  }

  private listWhere(
    query: FindParticipationCampaignsQueryDto,
  ): Prisma.ParticipationCampaignWhereInput {
    const filters: Prisma.ParticipationCampaignWhereInput[] = [];
    if (query.isActive != null) {
      filters.push({ isActive: query.isActive });
    }
    if (query.q) {
      filters.push({
        OR: [
          { name: containsInsensitive(query.q) },
          { description: containsInsensitive(query.q) },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private listOrderBy(
    query: FindParticipationCampaignsQueryDto,
  ): Prisma.ParticipationCampaignOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.ParticipationCampaignOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => ({ name: dir }),
        startDate: (dir) => ({ startDate: dir }),
        endDate: (dir) => ({ endDate: dir }),
        totalAmount: (dir) => ({ totalAmount: dir }),
        sharePrice: (dir) => ({ sharePrice: dir }),
        isActive: (dir) => ({ isActive: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  private assertAmounts(totalAmount: number, sharePrice: number) {
    if (sharePrice > totalAmount) {
      throw new BadRequestException('قیمت سهم نمی‌تواند از مبلغ کل بیشتر باشد');
    }
  }

  private assertDates(startDate: string, endDate: string) {
    if (parseDateOnly(endDate) < parseDateOnly(startDate)) {
      throw new BadRequestException('تاریخ پایان باید بعد از تاریخ شروع باشد');
    }
  }

  private async assertPaymentTargets(
    bankAccountId?: string | null,
    cryptoWalletId?: string | null,
  ) {
    if (!bankAccountId && !cryptoWalletId) {
      throw new BadRequestException(
        'حداقل یک حساب بانکی یا کیف پول ارز دیجیتال انتخاب کنید',
      );
    }
    if (bankAccountId) {
      const account = await this.prisma.bankAccount.findUnique({
        where: { id: bankAccountId },
        select: { id: true },
      });
      if (!account) {
        throw new BadRequestException('حساب بانکی انتخاب‌شده معتبر نیست');
      }
    }
    if (cryptoWalletId) {
      const wallet = await this.prisma.cryptoWallet.findUnique({
        where: { id: cryptoWalletId },
        select: { id: true },
      });
      if (!wallet) {
        throw new BadRequestException('کیف پول انتخاب‌شده معتبر نیست');
      }
    }
  }
}
