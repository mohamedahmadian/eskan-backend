import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { currentJalaliYear, jalaliMonth, jalaliYearRange } from '../common/jalali-year';
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
import { FindCampaignReportQueryDto } from './dto/find-campaign-report-query.dto';
import { FindParticipationCampaignsQueryDto } from './dto/find-campaigns-query.dto';
import { UpdateParticipationCampaignDto } from './dto/update-campaign.dto';

const campaignInclude = {
  bankAccount: true,
  cryptoWallet: true,
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
    });
    if (!items.length) {
      return [];
    }
    const statsById = await this.campaignContributionStats(items.map((item) => item.id));
    return items.map((item) => {
      const row = statsById.get(item.id);
      const stats = campaignStats(
        item.totalAmount,
        item.sharePrice,
        row?.purchasedShares ?? 0,
        row?.participantCount ?? 0,
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

  async findPublicOne(id: string) {
    const item = await this.prisma.participationCampaign.findFirst({
      where: { id, isActive: true },
      include: campaignInclude,
    });
    if (!item) {
      throw new NotFoundException('پویش یافت نشد');
    }
    const [serialized] = await this.serializeMany([item]);
    return {
      id: serialized.id,
      name: serialized.name,
      startDate: serialized.startDate,
      endDate: serialized.endDate,
      description: serialized.description,
      imageId: serialized.imageId,
      isActive: serialized.isActive,
      totalAmount: serialized.totalAmount,
      sharePrice: serialized.sharePrice,
      totalShares: serialized.totalShares,
      purchasedShares: serialized.purchasedShares,
      remainingShares: serialized.remainingShares,
      participantCount: serialized.participantCount,
      progressPercent: serialized.progressPercent,
      bankAccount: item.bankAccount
        ? {
            bankName: item.bankAccount.bankName,
            accountNumber: item.bankAccount.accountNumber,
            cardNumber: item.bankAccount.cardNumber,
            iban: item.bankAccount.iban,
          }
        : null,
      cryptoWallet: item.cryptoWallet
        ? {
            label: item.cryptoWallet.label,
            currency: item.cryptoWallet.currency,
            network: item.cryptoWallet.network,
            address: item.cryptoWallet.address,
          }
        : null,
    };
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

  async report(query: FindCampaignReportQueryDto) {
    const year = query.year ?? null;
    const where: Prisma.ParticipationCampaignWhereInput = {};
    if (year != null) {
      const range = jalaliYearRange(year);
      where.startDate = { gte: range.gte, lt: range.lt };
    }

    const campaigns = await this.prisma.participationCampaign.findMany({
      where,
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isActive: true,
        totalAmount: true,
        sharePrice: true,
        bankAccountId: true,
        cryptoWalletId: true,
      },
    });

    const contributionRows = campaigns.length
      ? await this.prisma.contribution.findMany({
          where: { campaignId: { in: campaigns.map((item) => item.id) }, type: 'CASH' },
          select: {
            campaignId: true,
            amount: true,
            shareCount: true,
            benefactorId: true,
            trackingCode: true,
          },
        })
      : [];

    const contribByCampaign = new Map<
      string,
      { amount: number; shares: number; participants: number; benefactors: Set<string>; online: number }
    >();
    const allBenefactors = new Set<string>();
    let onlineCount = 0;
    for (const row of contributionRows) {
      if (!row.campaignId) continue;
      const current = contribByCampaign.get(row.campaignId) ?? {
        amount: 0,
        shares: 0,
        participants: 0,
        benefactors: new Set<string>(),
        online: 0,
      };
      current.amount += row.amount;
      current.shares += row.shareCount ?? 0;
      current.participants += 1;
      current.benefactors.add(row.benefactorId);
      if (row.trackingCode) {
        current.online += 1;
        onlineCount += 1;
      }
      contribByCampaign.set(row.campaignId, current);
      allBenefactors.add(row.benefactorId);
    }

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
    }).format(new Date());

    let activeCount = 0;
    let targetAmount = 0;
    let collectedAmount = 0;
    let purchasedShares = 0;
    let totalShares = 0;
    let participantCount = 0;
    let progressSum = 0;
    let completedCount = 0;
    let emptyCount = 0;
    let inProgressCount = 0;
    let upcomingCount = 0;
    let runningCount = 0;
    let endedCount = 0;
    let bankOnlyCount = 0;
    let cryptoOnlyCount = 0;
    let bothPaymentCount = 0;

    const yearMap = new Map<
      number,
      {
        year: number;
        count: number;
        targetAmount: number;
        collectedAmount: number;
        purchasedShares: number;
        participantCount: number;
      }
    >();
    const monthMap = new Map<
      number,
      {
        month: number;
        count: number;
        targetAmount: number;
        collectedAmount: number;
        purchasedShares: number;
        participantCount: number;
      }
    >();
    const ranked: {
      id: string;
      name: string;
      count: number;
      amount: number;
      purchasedShares: number;
      progressPercent: number;
    }[] = [];

    for (const campaign of campaigns) {
      const contrib = contribByCampaign.get(campaign.id);
      const shares = contrib?.shares ?? 0;
      const amount = contrib?.amount ?? 0;
      const participants = contrib?.participants ?? 0;
      const stats = campaignStats(
        campaign.totalAmount,
        campaign.sharePrice,
        shares,
        participants,
      );
      if (campaign.isActive) activeCount += 1;
      targetAmount += campaign.totalAmount;
      collectedAmount += amount;
      purchasedShares += shares;
      totalShares += stats.totalShares;
      participantCount += participants;
      progressSum += stats.progressPercent;
      if (shares <= 0) emptyCount += 1;
      else if (stats.progressPercent >= 100) completedCount += 1;
      else inProgressCount += 1;

      const start = dateOnly(campaign.startDate);
      const end = dateOnly(campaign.endDate);
      if (start > today) upcomingCount += 1;
      else if (end < today) endedCount += 1;
      else runningCount += 1;

      if (campaign.bankAccountId && campaign.cryptoWalletId) bothPaymentCount += 1;
      else if (campaign.bankAccountId) bankOnlyCount += 1;
      else if (campaign.cryptoWalletId) cryptoOnlyCount += 1;

      const jalaliYear = currentJalaliYear(campaign.startDate);
      const yearRow = yearMap.get(jalaliYear) ?? {
        year: jalaliYear,
        count: 0,
        targetAmount: 0,
        collectedAmount: 0,
        purchasedShares: 0,
        participantCount: 0,
      };
      yearRow.count += 1;
      yearRow.targetAmount += campaign.totalAmount;
      yearRow.collectedAmount += amount;
      yearRow.purchasedShares += shares;
      yearRow.participantCount += participants;
      yearMap.set(jalaliYear, yearRow);

      const month = jalaliMonth(campaign.startDate);
      const monthRow = monthMap.get(month) ?? {
        month,
        count: 0,
        targetAmount: 0,
        collectedAmount: 0,
        purchasedShares: 0,
        participantCount: 0,
      };
      monthRow.count += 1;
      monthRow.targetAmount += campaign.totalAmount;
      monthRow.collectedAmount += amount;
      monthRow.purchasedShares += shares;
      monthRow.participantCount += participants;
      monthMap.set(month, monthRow);

      ranked.push({
        id: campaign.id,
        name: campaign.name,
        count: participants,
        amount,
        purchasedShares: shares,
        progressPercent: stats.progressPercent,
      });
    }

    const byYear = [...yearMap.values()].sort((a, b) => a.year - b.year);
    const byMonth = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return (
        monthMap.get(month) ?? {
          month,
          count: 0,
          targetAmount: 0,
          collectedAmount: 0,
          purchasedShares: 0,
          participantCount: 0,
        }
      );
    });

    const totalCount = campaigns.length;
    return {
      year,
      totalCount,
      activeCount,
      inactiveCount: totalCount - activeCount,
      targetAmount,
      collectedAmount,
      purchasedShares,
      remainingShares: Math.max(0, totalShares - purchasedShares),
      totalShares,
      participantCount,
      benefactorCount: allBenefactors.size,
      onlineCount,
      avgProgress: totalCount ? Math.round(progressSum / totalCount) : 0,
      completedCount,
      emptyCount,
      inProgressCount,
      upcomingCount,
      runningCount,
      endedCount,
      byActive: [
        { key: 'active', count: activeCount },
        { key: 'inactive', count: totalCount - activeCount },
      ],
      byProgress: [
        { key: 'empty', count: emptyCount },
        { key: 'inProgress', count: inProgressCount },
        { key: 'completed', count: completedCount },
      ],
      byLifecycle: [
        { key: 'upcoming', count: upcomingCount },
        { key: 'running', count: runningCount },
        { key: 'ended', count: endedCount },
      ],
      byPayment: [
        { key: 'bank', count: bankOnlyCount },
        { key: 'crypto', count: cryptoOnlyCount },
        { key: 'both', count: bothPaymentCount },
      ],
      byYear,
      byMonth,
      topByAmount: [...ranked].sort((a, b) => b.amount - a.amount).slice(0, 8),
      topByParticipants: [...ranked].sort((a, b) => b.count - a.count).slice(0, 8),
      topByProgress: [...ranked]
        .sort((a, b) => b.progressPercent - a.progressPercent)
        .slice(0, 8),
    };
  }

  private async serializeMany(items: CampaignRecord[]) {
    if (!items.length) {
      return [];
    }
    const statsById = await this.campaignContributionStats(items.map((item) => item.id));
    return items.map((item) => {
      const row = statsById.get(item.id);
      const stats = campaignStats(
        item.totalAmount,
        item.sharePrice,
        row?.purchasedShares ?? 0,
        row?.participantCount ?? 0,
      );
      return {
        ...item,
        startDate: dateOnly(item.startDate),
        endDate: dateOnly(item.endDate),
        ...stats,
      };
    });
  }

  private async campaignContributionStats(ids: string[]) {
    const stats = new Map<
      string,
      { purchasedShares: number; participantCount: number }
    >();
    if (!ids.length) {
      return stats;
    }
    const grouped = await this.prisma.contribution.groupBy({
      by: ['campaignId'],
      where: { campaignId: { in: ids }, type: 'CASH' },
      _sum: { shareCount: true },
      _count: { _all: true },
    });
    for (const row of grouped) {
      if (!row.campaignId) continue;
      stats.set(row.campaignId, {
        purchasedShares: row._sum.shareCount ?? 0,
        participantCount: row._count._all,
      });
    }
    return stats;
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
