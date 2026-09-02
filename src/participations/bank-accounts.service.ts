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
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { FindBankAccountsQueryDto } from './dto/find-bank-accounts-query.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

@Injectable()
export class BankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  listPublic() {
    return this.prisma.bankAccount.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        bankName: true,
        accountNumber: true,
        cardNumber: true,
        iban: true,
      },
    });
  }

  async findAll(query: FindBankAccountsQueryDto) {
    const where = this.listWhere(query);
    const orderBy = this.listOrderBy(query);
    if (!wantsPagination(query)) {
      return this.prisma.bankAccount.findMany({ where, orderBy });
    }
    const { page, pageSize, skip, take } = paginationArgs(query);
    const [items, total] = await Promise.all([
      this.prisma.bankAccount.findMany({ where, orderBy, skip, take }),
      this.prisma.bankAccount.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  async findOne(id: string) {
    const item = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('حساب بانکی یافت نشد');
    }
    return item;
  }

  create(dto: CreateBankAccountDto) {
    return this.prisma.bankAccount.create({
      data: {
        bankName: dto.bankName.trim(),
        accountNumber: dto.accountNumber.trim(),
        cardNumber: dto.cardNumber?.trim() || null,
        iban: dto.iban.trim().toUpperCase(),
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateBankAccountDto) {
    await this.findOne(id);
    return this.prisma.bankAccount.update({
      where: { id },
      data: {
        bankName: dto.bankName?.trim(),
        accountNumber: dto.accountNumber?.trim(),
        cardNumber:
          dto.cardNumber === undefined ? undefined : dto.cardNumber?.trim() || null,
        iban: dto.iban?.trim().toUpperCase(),
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.bankAccount.delete({ where: { id } });
    return { ok: true };
  }

  private listWhere(query: FindBankAccountsQueryDto): Prisma.BankAccountWhereInput {
    const filters: Prisma.BankAccountWhereInput[] = [];
    if (query.isActive != null) {
      filters.push({ isActive: query.isActive });
    }
    if (query.q) {
      filters.push({
        OR: [
          { bankName: containsInsensitive(query.q) },
          { accountNumber: containsInsensitive(query.q) },
          { cardNumber: containsInsensitive(query.q) },
          { iban: containsInsensitive(query.q) },
        ],
      });
    }
    if (!filters.length) {
      return {};
    }
    return filters.length === 1 ? filters[0] : { AND: filters };
  }

  private listOrderBy(
    query: FindBankAccountsQueryDto,
  ): Prisma.BankAccountOrderByWithRelationInput[] {
    return resolveSortOrder<Prisma.BankAccountOrderByWithRelationInput>(
      query.sortBy,
      query.sortDir,
      {
        bankName: (dir) => ({ bankName: dir }),
        accountNumber: (dir) => ({ accountNumber: dir }),
        cardNumber: (dir) => ({ cardNumber: dir }),
        iban: (dir) => ({ iban: dir }),
        isActive: (dir) => ({ isActive: dir }),
      },
      [{ createdAt: 'desc' }, { id: 'asc' }],
    );
  }
}
