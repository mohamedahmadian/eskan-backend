import { Injectable, NotFoundException } from '@nestjs/common';
import { currentJalaliYear } from '../common/jalali-year';
import {
  containsInsensitive,
  normalizeSearchDigits,
  startsWithInsensitive,
} from '../common/pagination';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MATCH_LIMIT = 20;

const geoSelect = {
  id: true,
  nameFa: true,
  nameEn: true,
} satisfies Prisma.CountrySelect;

const citySelect = {
  id: true,
  nameFa: true,
  nameEn: true,
  provinceId: true,
} satisfies Prisma.CitySelect;

const roleSelect = {
  code: true,
  nameKey: true,
} satisfies Prisma.RoleSelect;

export type ReceptionKind = 'pilgrim' | 'caravanManager' | 'accommodationManager';

@Injectable()
export class ReceptionService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string) {
    const where = this.searchWhere(q);
    const digits = normalizeSearchDigits(q);
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        take: MATCH_LIMIT,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          fullName: true,
          firstName: true,
          lastName: true,
          nationalId: true,
          phone: true,
          photoId: true,
          gender: true,
          status: true,
          city: { select: citySelect },
          userRoles: { select: { role: { select: roleSelect } } },
          _count: {
            select: {
              reservationMembers: true,
              createdReservations: true,
              managedCaravans: true,
              managedAccommodations: true,
            },
          },
        },
      }),
    ]);

    const matches = users
      .map((user) => this.toMatch(user))
      .sort((a, b) => this.matchRank(a, q, digits) - this.matchRank(b, q, digits));
    const profile = matches.length === 1 ? await this.profile(matches[0].id) : null;

    return { q, total, matches, profile };
  }

  async profile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        firstName: true,
        lastName: true,
        nationalId: true,
        phone: true,
        photoId: true,
        gender: true,
        status: true,
        birthDate: true,
        email: true,
        address: true,
        notes: true,
        religion: true,
        religionOther: true,
        country: { select: geoSelect },
        province: { select: geoSelect },
        city: { select: citySelect },
        userRoles: { select: { role: { select: roleSelect } } },
        _count: {
          select: {
            reservationMembers: true,
            createdReservations: true,
            managedCaravans: true,
            managedAccommodations: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('شخص یافت نشد');
    }

    const kinds = this.kindsFor(user.userRoles, user._count);
    const year = currentJalaliYear();

    const [memberships, caravans, caravanReservations, managerRows] =
      await Promise.all([
        this.prisma.reservationMember.findMany({
          where: { userId: id },
          orderBy: [
            { reservation: { year: 'desc' } },
            { reservation: { createdAt: 'desc' } },
          ],
          select: {
            id: true,
            reservation: {
              select: {
                id: true,
                year: true,
                type: true,
                status: true,
                stayStartDate: true,
                stayEndDate: true,
                walkingStartDate: true,
                requestedMaleCount: true,
                requestedFemaleCount: true,
                maleCount: true,
                femaleCount: true,
                totalCount: true,
                originCity: { select: citySelect },
                walkingRoute: { select: { id: true, name: true } },
                caravan: { select: { id: true, name: true } },
                group: { select: { id: true, name: true } },
              },
            },
          },
        }),
        this.prisma.caravan.findMany({
          where: { managerUserId: id },
          orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            name: true,
            isActive: true,
            licenseNumber: true,
            officePhone: true,
            maleCount: true,
            femaleCount: true,
            totalCount: true,
            city: { select: citySelect },
          },
        }),
        this.prisma.reservation.findMany({
          where: {
            OR: [
              { caravanManagerId: id },
              { caravan: { managerUserId: id } },
            ],
          },
          orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            year: true,
            type: true,
            status: true,
            stayStartDate: true,
            stayEndDate: true,
            walkingStartDate: true,
            requestedMaleCount: true,
            requestedFemaleCount: true,
            maleCount: true,
            femaleCount: true,
            totalCount: true,
            originCity: { select: citySelect },
            walkingRoute: { select: { id: true, name: true } },
            caravan: { select: { id: true, name: true } },
            group: { select: { id: true, name: true } },
          },
        }),
        this.prisma.accommodationManager.findMany({
          where: { userId: id },
          orderBy: [{ year: 'desc' }, { isPrimary: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            year: true,
            isPrimary: true,
            accommodation: {
              select: {
                id: true,
                name: true,
                type: true,
                status: true,
                genderType: true,
                phone: true,
                address: true,
                maleCapacity: true,
                femaleCapacity: true,
                assignedMaleCapacity: true,
                assignedFemaleCapacity: true,
                city: { select: citySelect },
              },
            },
          },
        }),
      ]);

    const accIds = [
      ...new Set(managerRows.map((row) => row.accommodation.id)),
    ];
    const years = [...new Set(managerRows.map((row) => row.year))];
    const iceGroups =
      accIds.length && years.length
        ? await this.prisma.iceVoucher.groupBy({
            by: ['accommodationId', 'year'],
            where: {
              accommodationId: { in: accIds },
              year: { in: years },
            },
            _count: { _all: true },
            _sum: { moldCount: true },
          })
        : [];
    const iceKey = (accommodationId: string, iceYear: number) =>
      `${accommodationId}:${iceYear}`;
    const iceMap = new Map(
      iceGroups.map((row) => [
        iceKey(row.accommodationId, row.year),
        {
          count: row._count._all,
          moldCount: row._sum.moldCount ?? 0,
        },
      ]),
    );

    const person = {
      id: user.id,
      fullName: user.fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      nationalId: user.nationalId,
      phone: user.phone,
      photoId: user.photoId,
      gender: user.gender,
      status: user.status,
      birthDate: toDateOnly(user.birthDate),
      email: user.email,
      address: user.address,
      notes: user.notes,
      religion: user.religion,
      religionOther: user.religionOther,
      country: user.country,
      province: user.province,
      city: user.city,
      roles: user.userRoles.map((item) => item.role),
      kinds,
    };

    const pilgrimVisits = memberships.map((item) =>
      this.toVisit(item.reservation),
    );
    const showPilgrim = kinds.includes('pilgrim') || pilgrimVisits.length > 0;

    const showCaravan =
      kinds.includes('caravanManager') ||
      caravans.length > 0 ||
      caravanReservations.length > 0;

    const history = managerRows.map((row) => {
      const ice = iceMap.get(iceKey(row.accommodation.id, row.year));
      return {
        assignmentId: row.id,
        year: row.year,
        isPrimary: row.isPrimary,
        iceVoucherCount: ice?.count ?? 0,
        iceMoldCount: ice?.moldCount ?? 0,
        accommodation: this.toAccommodationSummary(row.accommodation),
      };
    });
    const showHousing = kinds.includes('accommodationManager') || history.length > 0;

    return {
      person,
      currentYear: year,
      pilgrim: showPilgrim
        ? {
            visits: pilgrimVisits,
          }
        : null,
      caravanManager: showCaravan
        ? {
            caravans: caravans.map((item) => ({
              id: item.id,
              name: item.name,
              isActive: item.isActive,
              licenseNumber: item.licenseNumber,
              officePhone: item.officePhone,
              maleCount: item.maleCount,
              femaleCount: item.femaleCount,
              totalCount: item.totalCount,
              city: item.city,
            })),
            visits: caravanReservations.map((item) => this.toVisit(item)),
          }
        : null,
      accommodationManager: showHousing
        ? {
            current: history.filter((item) => item.year === year),
            history,
          }
        : null,
    };
  }

  private toMatch(user: {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    nationalId: string | null;
    phone: string | null;
    photoId: string | null;
    gender: string | null;
    status: string;
    city: { id: string; nameFa: string; nameEn: string; provinceId: string } | null;
    userRoles: { role: { code: string; nameKey: string } }[];
    _count: {
      reservationMembers: number;
      createdReservations: number;
      managedCaravans: number;
      managedAccommodations: number;
    };
  }) {
    return {
      id: user.id,
      fullName: user.fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      nationalId: user.nationalId,
      phone: user.phone,
      photoId: user.photoId,
      gender: user.gender,
      status: user.status,
      city: user.city,
      roles: user.userRoles.map((item) => item.role),
      kinds: this.kindsFor(user.userRoles, user._count),
    };
  }

  private kindsFor(
    userRoles: { role: { code: string } }[],
    counts: {
      reservationMembers: number;
      createdReservations: number;
      managedCaravans: number;
      managedAccommodations: number;
    },
  ): ReceptionKind[] {
    const codes = new Set(userRoles.map((item) => item.role.code));
    const kinds: ReceptionKind[] = [];
    if (codes.has('PILGRIM') || counts.reservationMembers > 0 || counts.createdReservations > 0) {
      kinds.push('pilgrim');
    }
    if (codes.has('CARAVAN_MANAGER') || counts.managedCaravans > 0) {
      kinds.push('caravanManager');
    }
    if (codes.has('ACCOMMODATION_MANAGER') || counts.managedAccommodations > 0) {
      kinds.push('accommodationManager');
    }
    return kinds;
  }

  private matchRank(
    item: { nationalId: string | null; phone: string | null; fullName: string },
    term: string,
    digits: string,
  ) {
    if (digits && item.nationalId === digits) return 0;
    if (digits && item.phone === digits) return 1;
    if (item.fullName === term) return 2;
    if (item.fullName.startsWith(term)) return 3;
    return 4;
  }

  private toVisit(reservation: {
    id: string;
    year: number;
    type: string;
    status: string;
    stayStartDate: Date | null;
    stayEndDate: Date | null;
    walkingStartDate: Date | null;
    requestedMaleCount: number;
    requestedFemaleCount: number;
    maleCount: number;
    femaleCount: number;
    totalCount: number;
    originCity: {
      id: string;
      nameFa: string;
      nameEn: string;
      provinceId: string;
    } | null;
    walkingRoute: { id: string; name: string } | null;
    caravan: { id: string; name: string } | null;
    group: { id: string; name: string } | null;
  }) {
    return {
      id: reservation.id,
      year: reservation.year,
      type: reservation.type,
      status: reservation.status,
      stayStartDate: toDateOnly(reservation.stayStartDate),
      stayEndDate: toDateOnly(reservation.stayEndDate),
      walkingStartDate: toDateOnly(reservation.walkingStartDate),
      originCity: reservation.originCity,
      walkingRoute: reservation.walkingRoute,
      requestedMaleCount: reservation.requestedMaleCount,
      requestedFemaleCount: reservation.requestedFemaleCount,
      maleCount: reservation.maleCount,
      femaleCount: reservation.femaleCount,
      totalCount: reservation.totalCount,
      partyName: reservation.caravan?.name ?? reservation.group?.name ?? null,
      partyKind: reservation.caravan
        ? ('caravan' as const)
        : reservation.group
          ? ('group' as const)
          : null,
      caravanId: reservation.caravan?.id ?? null,
      groupId: reservation.group?.id ?? null,
    };
  }

  private toAccommodationSummary(item: {
    id: string;
    name: string;
    type: string;
    status: string;
    genderType: string;
    phone: string | null;
    address: string | null;
    maleCapacity: number;
    femaleCapacity: number;
    assignedMaleCapacity: number;
    assignedFemaleCapacity: number;
    city: { id: string; nameFa: string; nameEn: string; provinceId: string } | null;
  }) {
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      status: item.status,
      genderType: item.genderType,
      phone: item.phone,
      address: item.address,
      maleCapacity: item.maleCapacity,
      femaleCapacity: item.femaleCapacity,
      assignedMaleCapacity: item.assignedMaleCapacity,
      assignedFemaleCapacity: item.assignedFemaleCapacity,
      city: item.city,
    };
  }

  private searchWhere(q: string): Prisma.UserWhereInput {
    const digits = normalizeSearchDigits(q);
    const mostlyDigits =
      digits.length >= 7 &&
      digits.length / Math.max(q.replace(/\s/g, '').length, 1) >= 0.8;

    if (mostlyDigits) {
      return {
        OR: [
          { nationalId: digits },
          { phone: digits },
          { nationalId: startsWithInsensitive(digits) },
          { phone: startsWithInsensitive(digits) },
          { username: startsWithInsensitive(digits) },
        ],
      };
    }

    const text = containsInsensitive(q);
    return {
      OR: [
        { firstName: text },
        { lastName: text },
        { fullName: text },
        { nationalId: text },
        { phone: text },
        { username: text },
      ],
    };
  }
}

function toDateOnly(value?: Date | string | null) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}
