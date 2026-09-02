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
import { CreateCryptoWalletDto } from './dto/create-crypto-wallet.dto';
import { FindCryptoWalletsQueryDto } from './dto/find-crypto-wallets-query.dto';
import { UpdateCryptoWalletDto } from './dto/update-crypto-wallet.dto';

@Injectable()
export class CryptoWalletsService {
  constructor(private readonly prisma: PrismaService) {}

  listPublic() {
    return this.prisma.cryptoWallet.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        label: true,
        currency: true,
        network: true,
        address: true,
      },
    });
  }

  async findAll(query: FindCryptoWalletsQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      return this.prisma.cryptoWallet.findMany({ where, orderBy });
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.cryptoWallet.findMany({ where, orderBy, skip, take }),
      this.prisma.cryptoWallet.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  async findOne(id: string) {
    const item = await this.prisma.cryptoWallet.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('کیف پول یافت نشد');
    }
    return item;
  }

  create(dto: CreateCryptoWalletDto) {
    return this.prisma.cryptoWallet.create({
      data: {
        currency: dto.currency,
        network: dto.network?.trim() || null,
        address: dto.address.trim(),
        label: dto.label.trim(),
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateCryptoWalletDto) {
    await this.findOne(id);
    return this.prisma.cryptoWallet.update({
      where: { id },
      data: {
        currency: dto.currency,
        network:
          dto.network === undefined ? undefined : dto.network?.trim() || null,
        address: dto.address?.trim(),
        label: dto.label?.trim(),
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.cryptoWallet.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(query: FindCryptoWalletsQueryDto): Prisma.CryptoWalletWhereInput {
    const filters: Prisma.CryptoWalletWhereInput[] = [];
    if (query.currency) {
      filters.push({ currency: query.currency });
    }
    if (query.isActive != null) {
      filters.push({ isActive: query.isActive });
    }
    if (query.q) {
      filters.push({
        OR: [
          { label: containsInsensitive(query.q) },
          { currency: containsInsensitive(query.q) },
          { network: containsInsensitive(query.q) },
          { address: containsInsensitive(query.q) },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private listOrderBy(
    query: FindCryptoWalletsQueryDto,
  ): Prisma.CryptoWalletOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.CryptoWalletOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        label: (dir) => ({ label: dir }),
        currency: (dir) => ({ currency: dir }),
        network: (dir) => ({ network: dir }),
        address: (dir) => ({ address: dir }),
        isActive: (dir) => ({ isActive: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }
}
