import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { ContributionTypeValue } from '../participations/participations.constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  DATA_WIPE_ENTITY_CODES,
  isDataWipeEntityCode,
  type DataWipeEntityCode,
} from './data-wipe.registry';

type Actor = { id: string };

@Injectable()
export class DataManagementService {
  private readonly logger = new Logger(DataManagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await Promise.all(
      DATA_WIPE_ENTITY_CODES.map(async (code) => ({
        code,
        recordCount: await this.count(code),
      })),
    );
    return { items };
  }

  async wipe(code: string, actor: Actor) {
    if (!isDataWipeEntityCode(code)) {
      throw new BadRequestException('موجودیت نامعتبر است');
    }

    const deleted = await this.wipeEntity(code);
    this.logger.warn(
      `data-management.wipe code=${code} deleted=${deleted} by=${actor.id}`,
    );
    return { code, deleted };
  }

  private count(code: DataWipeEntityCode) {
    switch (code) {
      case 'reservations':
        return this.prisma.reservation.count();
      case 'contributions-cash':
        return this.prisma.contribution.count({
          where: { type: 'CASH' },
        });
      case 'contributions-in-kind':
        return this.prisma.contribution.count({
          where: { type: 'IN_KIND' },
        });
    }
  }

  private wipeEntity(code: DataWipeEntityCode) {
    switch (code) {
      case 'reservations':
        return this.wipeReservations();
      case 'contributions-cash':
        return this.wipeContributions('CASH');
      case 'contributions-in-kind':
        return this.wipeContributions('IN_KIND');
    }
  }

  /** Deletes all pilgrimage files; child tables cascade in DB. Permit images are cleaned up after. */
  private async wipeReservations() {
    return this.prisma.$transaction(async (tx) => {
      const withPermitImage = await tx.reservation.findMany({
        where: { permitImageId: { not: null } },
        select: { permitImageId: true },
      });
      const permitImageIds = withPermitImage
        .map((row) => row.permitImageId)
        .filter((id): id is string => Boolean(id));

      const deleted = await tx.reservation.deleteMany({});

      if (permitImageIds.length) {
        await tx.storedImage.deleteMany({
          where: { id: { in: permitImageIds } },
        });
      }

      return deleted.count;
    });
  }

  private async wipeContributions(type: ContributionTypeValue) {
    const deleted = await this.prisma.contribution.deleteMany({
      where: { type },
    });
    return deleted.count;
  }
}
