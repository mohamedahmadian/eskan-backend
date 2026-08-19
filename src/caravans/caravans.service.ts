import { Injectable, NotFoundException } from '@nestjs/common';
import {
  containsInsensitive,
  paginatedResult,
  paginationArgs,
  type PaginationQueryDto,
} from '../common/pagination';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCaravanDto } from './dto/create-caravan.dto';
import { UpdateCaravanDto } from './dto/update-caravan.dto';

@Injectable()
export class CaravansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto) {
    const { page, pageSize, skip, take } = paginationArgs(query);
    const where: Prisma.CaravanWhereInput | undefined = query.q
      ? {
          OR: [
            { name: containsInsensitive(query.q) },
            { originCity: containsInsensitive(query.q) },
          ],
        }
      : undefined;
    const [items, total] = await Promise.all([
      this.prisma.caravan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.caravan.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  }

  async findOne(id: string) {
    const caravan = await this.prisma.caravan.findUnique({ where: { id } });
    if (!caravan) {
      throw new NotFoundException('کاروان یافت نشد');
    }
    return caravan;
  }

  create(dto: CreateCaravanDto) {
    return this.prisma.caravan.create({
      data: {
        name: dto.name,
        originCity: dto.originCity,
        plannedArrival: dto.plannedArrival
          ? new Date(dto.plannedArrival)
          : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateCaravanDto) {
    await this.findOne(id);
    return this.prisma.caravan.update({
      where: { id },
      data: {
        name: dto.name,
        originCity: dto.originCity,
        plannedArrival: dto.plannedArrival
          ? new Date(dto.plannedArrival)
          : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.caravan.delete({ where: { id } });
    return { ok: true };
  }

  count() {
    return this.prisma.caravan.count();
  }
}
