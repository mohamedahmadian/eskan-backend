import { Injectable, NotFoundException } from '@nestjs/common';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  wantsPagination,
} from '../common/pagination';
import { resolveSortOrder } from '../common/sort-query';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignParticipantDto } from './dto/create-participant.dto';
import { FindCampaignParticipantsQueryDto } from './dto/find-participants-query.dto';
import { UpdateCampaignParticipantDto } from './dto/update-participant.dto';

@Injectable()
export class CampaignParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(campaignId: string, query: FindCampaignParticipantsQueryDto) {
    await this.assertCampaign(campaignId);
    const where = this.listWhere(campaignId, query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      return this.prisma.campaignParticipant.findMany({ where, orderBy });
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.campaignParticipant.findMany({ where, orderBy, skip, take }),
      this.prisma.campaignParticipant.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  async findOne(campaignId: string, id: string) {
    await this.assertCampaign(campaignId);
    const item = await this.prisma.campaignParticipant.findFirst({
      where: { id, campaignId },
    });
    if (!item) {
      throw new NotFoundException('مشارکت‌کننده یافت نشد');
    }
    return item;
  }

  async create(campaignId: string, dto: CreateCampaignParticipantDto) {
    const campaign = await this.assertCampaign(campaignId);
    const shareCount = dto.shareCount;
    const paidAmount = dto.paidAmount ?? shareCount * campaign.sharePrice;
    return this.prisma.campaignParticipant.create({
      data: {
        campaignId,
        fullName: dto.fullName.trim(),
        phone: dto.phone?.trim() || null,
        shareCount,
        paidAmount,
      },
    });
  }

  async update(
    campaignId: string,
    id: string,
    dto: UpdateCampaignParticipantDto,
  ) {
    const current = await this.findOne(campaignId, id);
    const campaign = await this.assertCampaign(campaignId);
    const shareCount = dto.shareCount ?? current.shareCount;
    const paidAmount =
      dto.paidAmount ??
      (dto.shareCount != null ? shareCount * campaign.sharePrice : undefined);
    return this.prisma.campaignParticipant.update({
      where: { id },
      data: {
        fullName: dto.fullName?.trim(),
        phone: dto.phone === undefined ? undefined : dto.phone?.trim() || null,
        shareCount: dto.shareCount,
        paidAmount,
      },
    });
  }

  async remove(campaignId: string, id: string) {
    await this.findOne(campaignId, id);
    await this.prisma.campaignParticipant.delete({ where: { id } });
    return { ok: true };
  }

  private async assertCampaign(campaignId: string) {
    const campaign = await this.prisma.participationCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, sharePrice: true },
    });
    if (!campaign) {
      throw new NotFoundException('پویش یافت نشد');
    }
    return campaign;
  }

  private listWhere(
    campaignId: string,
    query: FindCampaignParticipantsQueryDto,
  ): Prisma.CampaignParticipantWhereInput {
    const filters: Prisma.CampaignParticipantWhereInput[] = [{ campaignId }];
    if (query.q) {
      filters.push({
        OR: [
          { fullName: containsInsensitive(query.q) },
          { phone: containsInsensitive(query.q) },
        ],
      });
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private listOrderBy(
    query: FindCampaignParticipantsQueryDto,
  ): Prisma.CampaignParticipantOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.CampaignParticipantOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        fullName: (dir) => ({ fullName: dir }),
        phone: (dir) => ({ phone: dir }),
        shareCount: (dir) => ({ shareCount: dir }),
        paidAmount: (dir) => ({ paidAmount: dir }),
        createdAt: (dir) => ({ createdAt: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }
}
