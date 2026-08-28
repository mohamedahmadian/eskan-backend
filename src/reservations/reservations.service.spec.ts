import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ReservationStatus,
  ReservationType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlacementsService } from '../placements/placements.service';
import { UsersService } from '../users/users.service';
import { ReservationsService } from './reservations.service';

function pilgrim(id: string) {
  return { id, userRoles: [{ role: { code: 'PILGRIM' } }] };
}

function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'res-1',
    createdById: 'pilgrim-1',
    caravanManagerId: null,
    status: ReservationStatus.DRAFT,
    returnedToStatus: null,
    permitImageId: null,
    requestedMaleCount: 0,
    requestedFemaleCount: 0,
    maleCount: 0,
    femaleCount: 0,
    type: ReservationType.INDIVIDUAL,
    groupId: null,
    caravanId: null,
    year: 1405,
    members: [],
    ...overrides,
  };
}

describe('ReservationsService.remove', () => {
  const prisma = {
    reservation: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    storedImage: { deleteMany: jest.fn() },
    group: { update: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma),
    ),
  };

  const service = new ReservationsService(
    prisma as unknown as PrismaService,
    {} as UsersService,
    {} as PlacementsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
  });

  it('lets the pilgrim owner hard-delete a create draft', async () => {
    prisma.reservation.findUnique.mockResolvedValue(draftRow());
    prisma.reservation.delete.mockResolvedValue({ id: 'res-1' });

    await expect(service.remove('res-1', pilgrim('pilgrim-1'))).resolves.toEqual({
      ok: true,
    });
    expect(prisma.reservation.delete).toHaveBeenCalledWith({
      where: { id: 'res-1' },
    });
  });

  it('rejects a pilgrim who does not own the file', async () => {
    prisma.reservation.findUnique.mockResolvedValue(draftRow());

    await expect(service.remove('res-1', pilgrim('other'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.reservation.delete).not.toHaveBeenCalled();
  });

  it('rejects submitted or returned files', async () => {
    prisma.reservation.findUnique.mockResolvedValue(
      draftRow({ status: ReservationStatus.PENDING_MANAGEMENT_REVIEW }),
    );

    await expect(
      service.remove('res-1', pilgrim('pilgrim-1')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.reservation.delete).not.toHaveBeenCalled();
  });
});
