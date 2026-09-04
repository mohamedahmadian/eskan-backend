import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { buildStyledExcelExport } from '../common/excel-export';
import { currentJalaliYear, jalaliMonth, jalaliYearRange } from '../common/jalali-year';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ensureAnonymousBenefactor } from '../benefactors/anonymous-benefactor';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { FindContributionGoodsReportQueryDto } from './dto/find-contribution-goods-report-query.dto';
import { FindContributionReportQueryDto } from './dto/find-contribution-report-query.dto';
import { FindContributionsQueryDto } from './dto/find-contributions-query.dto';
import { UpdateContributionDto } from './dto/update-contribution.dto';

const contributionInclude = {
  benefactor: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  },
  goods: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true, sharePrice: true } },
} satisfies Prisma.ContributionInclude;

type ContributionRecord = Prisma.ContributionGetPayload<{
  include: typeof contributionInclude;
}>;

@Injectable()
export class ContributionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FindContributionsQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    const [items, total] = await Promise.all([
      this.prisma.contribution.findMany({
        where,
        orderBy,
        skip,
        take,
        include: contributionInclude,
      }),
      this.prisma.contribution.count({ where }),
    ]);
    return paginatedResult(
      items.map((item) => this.serialize(item)),
      total,
      page,
      pageSize,
    );
  }

  async report(query: FindContributionReportQueryDto) {
    const year = query.year ?? null;
    const excludeCampaigns = Boolean(query.excludeCampaigns);
    const where: Prisma.ContributionWhereInput = {};
    if (year != null) {
      const range = jalaliYearRange(year);
      where.createdAt = { gte: range.gte, lt: range.lt };
    }
    if (excludeCampaigns) {
      where.OR = [{ type: 'IN_KIND' }, { type: 'CASH', campaignId: null }];
    }

    const rows = await this.prisma.contribution.findMany({
      where,
      select: {
        type: true,
        amount: true,
        quantity: true,
        goodsId: true,
        benefactorId: true,
        campaignId: true,
        trackingCode: true,
        createdAt: true,
        benefactor: { select: { id: true, name: true } },
        goods: { select: { id: true, name: true } },
        campaign: { select: { id: true, name: true } },
      },
    });

    let cashCount = 0;
    let cashAmount = 0;
    let inKindCount = 0;
    let inKindAmount = 0;
    let onlineCount = 0;
    let onlineAmount = 0;
    let campaignLinkedCount = 0;
    let campaignLinkedAmount = 0;
    let totalAmount = 0;

    const yearMap = new Map<
      number,
      { year: number; count: number; amount: number; cashAmount: number; inKindAmount: number }
    >();
    const monthMap = new Map<
      number,
      { month: number; count: number; amount: number; cashAmount: number; inKindAmount: number }
    >();
    const goodsMap = new Map<
      string,
      { id: string; name: string; count: number; amount: number; quantity: number }
    >();
    const benefactorMap = new Map<
      string,
      { id: string; name: string; count: number; amount: number }
    >();
    const campaignMap = new Map<
      string,
      { id: string | null; name: string; count: number; amount: number }
    >();

    for (const row of rows) {
      const amount = row.amount;
      const isCash = row.type === 'CASH';
      totalAmount += amount;
      if (isCash) {
        cashCount += 1;
        cashAmount += amount;
      } else {
        inKindCount += 1;
        inKindAmount += amount;
      }
      if (row.trackingCode) {
        onlineCount += 1;
        onlineAmount += amount;
      }
      if (row.campaignId) {
        campaignLinkedCount += 1;
        campaignLinkedAmount += amount;
      }

      const jalaliYear = currentJalaliYear(row.createdAt);
      const yearRow = yearMap.get(jalaliYear) ?? {
        year: jalaliYear,
        count: 0,
        amount: 0,
        cashAmount: 0,
        inKindAmount: 0,
      };
      yearRow.count += 1;
      yearRow.amount += amount;
      if (isCash) yearRow.cashAmount += amount;
      else yearRow.inKindAmount += amount;
      yearMap.set(jalaliYear, yearRow);

      const month = jalaliMonth(row.createdAt);
      const monthRow = monthMap.get(month) ?? {
        month,
        count: 0,
        amount: 0,
        cashAmount: 0,
        inKindAmount: 0,
      };
      monthRow.count += 1;
      monthRow.amount += amount;
      if (isCash) monthRow.cashAmount += amount;
      else monthRow.inKindAmount += amount;
      monthMap.set(month, monthRow);

      if (row.goods) {
        const goodsRow = goodsMap.get(row.goods.id) ?? {
          id: row.goods.id,
          name: row.goods.name,
          count: 0,
          amount: 0,
          quantity: 0,
        };
        goodsRow.count += 1;
        goodsRow.amount += amount;
        goodsRow.quantity += row.quantity == null ? 0 : Number(row.quantity);
        goodsMap.set(row.goods.id, goodsRow);
      }

      const benefactorRow = benefactorMap.get(row.benefactor.id) ?? {
        id: row.benefactor.id,
        name: row.benefactor.name,
        count: 0,
        amount: 0,
      };
      benefactorRow.count += 1;
      benefactorRow.amount += amount;
      benefactorMap.set(row.benefactor.id, benefactorRow);

      const campaignKey = row.campaign?.id ?? 'none';
      const campaignRow = campaignMap.get(campaignKey) ?? {
        id: row.campaign?.id ?? null,
        name: row.campaign?.name ?? '',
        count: 0,
        amount: 0,
      };
      campaignRow.count += 1;
      campaignRow.amount += amount;
      campaignMap.set(campaignKey, campaignRow);
    }

    const byGoods = [...goodsMap.values()].sort((a, b) => b.amount - a.amount);
    const byBenefactor = [...benefactorMap.values()].sort((a, b) => b.amount - a.amount);
    const byCampaign = [...campaignMap.values()].sort((a, b) => b.amount - a.amount);
    const byYear = [...yearMap.values()].sort((a, b) => a.year - b.year);
    const byMonth = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return (
        monthMap.get(month) ?? {
          month,
          count: 0,
          amount: 0,
          cashAmount: 0,
          inKindAmount: 0,
        }
      );
    });

    const totalCount = rows.length;
    return {
      year,
      totalCount,
      totalAmount,
      cashCount,
      cashAmount,
      inKindCount,
      inKindAmount,
      benefactorCount: benefactorMap.size,
      goodsCount: goodsMap.size,
      campaignCount: [...campaignMap.values()].filter((item) => item.id).length,
      onlineCount,
      onlineAmount,
      campaignLinkedCount,
      campaignLinkedAmount,
      avgAmount: totalCount ? Math.round(totalAmount / totalCount) : 0,
      byType: [
        { type: 'CASH', count: cashCount, amount: cashAmount },
        { type: 'IN_KIND', count: inKindCount, amount: inKindAmount },
      ],
      byYear,
      byMonth,
      byGoods,
      byBenefactor,
      byCampaign,
      topGoods: byGoods.slice(0, 8),
      topBenefactors: byBenefactor.slice(0, 8),
    };
  }

  async goodsReport(query: FindContributionGoodsReportQueryDto) {
    const goods = await this.prisma.contributionGood.findUnique({
      where: { id: query.goodsId },
      select: { id: true, name: true },
    });
    if (!goods) {
      throw new NotFoundException('کالا یافت نشد');
    }

    const year = query.year ?? null;
    const where: Prisma.ContributionWhereInput = { goodsId: goods.id };
    if (year != null) {
      const range = jalaliYearRange(year);
      where.createdAt = { gte: range.gte, lt: range.lt };
    }

    const rows = await this.prisma.contribution.findMany({
      where,
      select: {
        amount: true,
        quantity: true,
        benefactorId: true,
        createdAt: true,
        unit: { select: { id: true, name: true } },
      },
    });

    const yearMap = new Map<
      number,
      { year: number; count: number; amount: number; quantity: number }
    >();
    const monthMap = new Map<
      number,
      { month: number; count: number; amount: number; quantity: number }
    >();
    const benefactorIds = new Set<string>();
    const unitIds = new Set<string>();
    let unitName: string | null = null;
    let totalAmount = 0;
    let totalQuantity = 0;

    for (const row of rows) {
      const amount = row.amount;
      const quantity = row.quantity == null ? 0 : Number(row.quantity);
      totalAmount += amount;
      totalQuantity += quantity;
      benefactorIds.add(row.benefactorId);
      if (row.unit) {
        unitIds.add(row.unit.id);
        unitName = row.unit.name;
      }

      const jalaliYear = currentJalaliYear(row.createdAt);
      const yearRow = yearMap.get(jalaliYear) ?? {
        year: jalaliYear,
        count: 0,
        amount: 0,
        quantity: 0,
      };
      yearRow.count += 1;
      yearRow.amount += amount;
      yearRow.quantity += quantity;
      yearMap.set(jalaliYear, yearRow);

      const month = jalaliMonth(row.createdAt);
      const monthRow = monthMap.get(month) ?? {
        month,
        count: 0,
        amount: 0,
        quantity: 0,
      };
      monthRow.count += 1;
      monthRow.amount += amount;
      monthRow.quantity += quantity;
      monthMap.set(month, monthRow);
    }

    if (unitIds.size !== 1) {
      unitName = null;
    }

    const byYear = [...yearMap.values()].sort((a, b) => a.year - b.year);
    const byMonth = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return (
        monthMap.get(month) ?? {
          month,
          count: 0,
          amount: 0,
          quantity: 0,
        }
      );
    });

    return {
      year,
      goods,
      unitName,
      totalCount: rows.length,
      totalAmount,
      totalQuantity,
      benefactorCount: benefactorIds.size,
      byYear,
      byMonth,
    };
  }

  async exportExcel(query: FindContributionsQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    const items = await this.prisma.contribution.findMany({
      where,
      orderBy,
      include: contributionInclude,
    });
    const typeLabel = (type: string) =>
      type === 'CASH' ? 'نقدی' : 'غیرنقدی';
    return buildStyledExcelExport({
      sheetName: 'مشارکت‌ها',
      columns: [
        { header: 'نوع', key: 'type', width: 14 },
        { header: 'خیر', key: 'benefactor', width: 28 },
        { header: 'مبلغ (تومان)', key: 'amount', width: 16 },
        { header: 'کالا', key: 'goods', width: 22 },
        { header: 'واحد', key: 'unit', width: 14 },
        { header: 'تعداد', key: 'quantity', width: 12 },
        { header: 'پویش', key: 'campaign', width: 24 },
        { header: 'تعداد سهم', key: 'shareCount', width: 12 },
        { header: 'کد پیگیری', key: 'trackingCode', width: 18 },
        { header: 'توضیحات', key: 'description', width: 32 },
      ],
      rows: items.map((item) => ({
        type: typeLabel(item.type),
        benefactor: item.benefactor.name,
        amount: item.amount,
        goods: item.goods?.name ?? '',
        unit: item.unit?.name ?? '',
        quantity: item.quantity == null ? '' : Number(item.quantity),
        campaign: item.campaign?.name ?? '',
        shareCount: item.shareCount ?? '',
        trackingCode: item.trackingCode ?? '',
        description: item.description ?? '',
      })),
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.contribution.findUnique({
      where: { id },
      include: contributionInclude,
    });
    if (!item) {
      throw new NotFoundException('مشارکت یافت نشد');
    }
    return this.serialize(item);
  }

  async create(dto: CreateContributionDto) {
    const data = await this.resolveData(dto);
    const item = await this.prisma.contribution.create({
      data,
      include: contributionInclude,
    });
    return this.serialize(item);
  }

  async update(id: string, dto: UpdateContributionDto) {
    const current = await this.findOne(id);
    const data = await this.resolveData({
      type: dto.type ?? current.type,
      benefactorId: dto.benefactorId ?? current.benefactorId,
      amount: dto.amount ?? current.amount,
      quantity: dto.quantity === undefined ? current.quantity : dto.quantity,
      goodsId: dto.goodsId === undefined ? current.goodsId : dto.goodsId,
      unitId: dto.unitId === undefined ? current.unitId : dto.unitId,
      campaignId:
        dto.campaignId === undefined ? current.campaignId : dto.campaignId,
      shareCount:
        dto.shareCount === undefined ? current.shareCount : dto.shareCount,
      trackingCode:
        dto.trackingCode === undefined ? current.trackingCode : dto.trackingCode,
      description:
        dto.description === undefined ? current.description : dto.description,
    });
    const item = await this.prisma.contribution.update({
      where: { id },
      data,
      include: contributionInclude,
    });
    return this.serialize(item);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.contribution.delete({ where: { id } });
    return { ok: true };
  }

  private async resolveBenefactorId(benefactorId?: string | null) {
    if (benefactorId) {
      const benefactor = await this.prisma.benefactor.findUnique({
        where: { id: benefactorId },
        select: { id: true },
      });
      if (!benefactor) {
        throw new BadRequestException('خیر انتخاب‌شده معتبر نیست');
      }
      return benefactor.id;
    }
    return (await ensureAnonymousBenefactor(this.prisma)).id;
  }

  private async resolveData(dto: CreateContributionDto) {
    const benefactorId = await this.resolveBenefactorId(dto.benefactorId);
    let campaign: { id: string; sharePrice: number } | null = null;
    if (dto.campaignId) {
      campaign = await this.prisma.participationCampaign.findUnique({
        where: { id: dto.campaignId },
        select: { id: true, sharePrice: true },
      });
      if (!campaign) {
        throw new BadRequestException('پویش انتخاب‌شده معتبر نیست');
      }
    }
    const shareCount = this.resolveShareCount(dto, campaign);
    if (dto.type === 'IN_KIND') {
      if (!dto.goodsId || !dto.unitId || dto.quantity == null) {
        throw new BadRequestException(
          'برای مشارکت غیرنقدی کالا، واحد و تعداد الزامی است',
        );
      }
      const [goods, unit] = await Promise.all([
        this.prisma.contributionGood.findUnique({
          where: { id: dto.goodsId },
          select: { id: true },
        }),
        this.prisma.goodsUnit.findUnique({
          where: { id: dto.unitId },
          select: { id: true },
        }),
      ]);
      if (!goods) {
        throw new BadRequestException('کالای انتخاب‌شده معتبر نیست');
      }
      if (!unit) {
        throw new BadRequestException('واحد انتخاب‌شده معتبر نیست');
      }
      return {
        type: dto.type,
        benefactorId,
        amount: dto.amount,
        quantity: new Prisma.Decimal(dto.quantity),
        goodsId: dto.goodsId,
        unitId: dto.unitId,
        campaignId: dto.campaignId ?? null,
        shareCount: null,
        trackingCode: dto.trackingCode?.trim() || null,
        description: dto.description?.trim() || null,
      };
    }
    return {
      type: dto.type,
      benefactorId,
      amount: this.resolveCashAmount(dto.amount, shareCount, campaign),
      quantity: null,
      goodsId: null,
      unitId: null,
      campaignId: dto.campaignId ?? null,
      shareCount,
      trackingCode: dto.trackingCode?.trim() || null,
      description: dto.description?.trim() || null,
    };
  }

  private resolveShareCount(
    dto: CreateContributionDto,
    campaign: { sharePrice: number } | null,
  ): number | null {
    if (!campaign || dto.type !== 'CASH') {
      return null;
    }
    if (dto.shareCount != null) {
      return dto.shareCount;
    }
    if (dto.amount != null && campaign.sharePrice > 0) {
      const derived = Math.floor(dto.amount / campaign.sharePrice);
      return derived > 0 ? derived : null;
    }
    return null;
  }

  private resolveCashAmount(
    amount: number | undefined,
    shareCount: number | null,
    campaign: { sharePrice: number } | null,
  ): number {
    if (amount != null && amount > 0) {
      return amount;
    }
    if (shareCount != null && campaign) {
      return shareCount * campaign.sharePrice;
    }
    if (amount != null) {
      return amount;
    }
    throw new BadRequestException('مبلغ اهدایی را وارد کنید');
  }

  private listWhere(
    query: FindContributionsQueryDto,
  ): Prisma.ContributionWhereInput {
    const filters: Prisma.ContributionWhereInput[] = [];
    if (query.type) {
      filters.push({ type: query.type });
    }
    if (query.benefactorId) {
      filters.push({ benefactorId: query.benefactorId });
    }
    if (query.goodsId) {
      filters.push({ goodsId: query.goodsId });
    }
    if (query.campaignId) {
      filters.push({ campaignId: query.campaignId });
    }
    if (query.q) {
      filters.push({
        OR: [
          { trackingCode: containsInsensitive(query.q) },
          { description: containsInsensitive(query.q) },
          { benefactor: { name: containsInsensitive(query.q) } },
          { benefactor: { firstName: containsInsensitive(query.q) } },
          { benefactor: { lastName: containsInsensitive(query.q) } },
          { goods: { name: containsInsensitive(query.q) } },
          { campaign: { name: containsInsensitive(query.q) } },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private listOrderBy(
    query: FindContributionsQueryDto,
  ): Prisma.ContributionOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.ContributionOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        type: (dir) => ({ type: dir }),
        benefactor: (dir) => ({ benefactor: { name: dir } }),
        amount: (dir) => ({ amount: dir }),
        quantity: (dir) => ({ quantity: dir }),
        goods: (dir) => ({ goods: { name: dir } }),
        campaign: (dir) => ({ campaign: { name: dir } }),
        shareCount: (dir) => ({ shareCount: dir }),
        trackingCode: (dir) => ({ trackingCode: dir }),
        createdAt: (dir) => ({ createdAt: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }

  private serialize(item: ContributionRecord) {
    return {
      ...item,
      quantity: item.quantity == null ? null : Number(item.quantity),
    };
  }
}
