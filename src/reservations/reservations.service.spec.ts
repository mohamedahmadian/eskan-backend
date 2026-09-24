import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ReservationStatus,
  ReservationType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlacementsService } from '../placements/placements.service';
import { SmsService } from '../sms/sms.service';
import { UsersService } from '../users/users.service';
import { ReservationsService } from './reservations.service';
import { openReservationWhere } from './reservation-workflow';

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
    {} as SmsService,
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

  it('lets the owner hard-delete a cancelled file', async () => {
    prisma.reservation.findUnique.mockResolvedValue(
      draftRow({
        status: ReservationStatus.CANCELLED,
        requestedMaleCount: 3,
        type: ReservationType.GROUP,
        groupId: 'group-1',
      }),
    );
    prisma.reservation.delete.mockResolvedValue({ id: 'res-1' });

    await expect(service.remove('res-1', pilgrim('pilgrim-1'))).resolves.toEqual({
      ok: true,
    });
    expect(prisma.reservation.delete).toHaveBeenCalledWith({
      where: { id: 'res-1' },
    });
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

describe('ReservationsService.findOpen', () => {
  const prisma = {
    reservation: {
      findFirst: jest.fn(),
    },
  };
  const service = new ReservationsService(
    prisma as unknown as PrismaService,
    {} as UsersService,
    {} as PlacementsService,
    {} as SmsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects looking up another user without admin access', async () => {
    await expect(service.findOpen(pilgrim('pilgrim-1'), 'other-user')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.reservation.findFirst).not.toHaveBeenCalled();
  });

  it('returns the latest open file for the actor', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: 'res-1',
      code: '1405-1',
      status: ReservationStatus.DRAFT,
      returnedToStatus: null,
      createdById: 'pilgrim-1',
    });

    await expect(service.findOpen(pilgrim('pilgrim-1'))).resolves.toMatchObject({
      id: 'res-1',
    });
    expect(prisma.reservation.findFirst).toHaveBeenCalledWith({
      where: openReservationWhere('pilgrim-1'),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        code: true,
        status: true,
        returnedToStatus: true,
        createdById: true,
      },
    });
  });
});
