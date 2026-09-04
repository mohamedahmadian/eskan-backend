import { Injectable, NotFoundException } from '@nestjs/common';
import { currentJalaliYear } from '../common/jalali-year';
import {
  containsInsensitive,
  normalizeSearchDigits,
  startsWithInsensitive,
} from '../common/pagination';
import {
  isReservationCodeQuery,
  normalizeReservationCode,
} from '../common/reservation-code';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  RECEPTION_SEARCH_PAGE_SIZE,
  type SearchReceptionQueryDto,
} from './dto/search-reception.dto';

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

const visitReservationSelect = {
  id: true,
  code: true,
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
  caravan: {
    select: {
      id: true,
      name: true,
      walkingRoute: { select: { id: true, name: true } },
    },
  },
  group: {
    select: {
      id: true,
      name: true,
      walkingRoute: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ReservationSelect;

const personMatchSelect = {
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
  honoraryServiceAnnouncements: {
    select: { serviceType: { select: { code: true, name: true } } },
    take: 8,
  },
  _count: {
    select: {
      reservationMembers: true,
      createdReservations: true,
      managedCaravans: true,
      managedAccommodations: true,
      honoraryAssignments: true,
    },
  },
} satisfies Prisma.UserSelect;

export type ReceptionKind = 'pilgrim' | 'caravanManager' | 'accommodationManager';

export type ReceptionRecordType =
  | 'person'
  | 'reservation'
  | 'accommodation'
  | 'walkingStation'
  | 'benefactor'
  | 'caravan';

const searchReservationSelect = {
  id: true,
  code: true,
  year: true,
  type: true,
  status: true,
  createdById: true,
  createdBy: { select: { fullName: true } },
  caravan: { select: { name: true } },
  group: { select: { name: true } },
} satisfies Prisma.ReservationSelect;

const searchPlaceCitySelect = {
  id: true,
  nameFa: true,
  nameEn: true,
  provinceId: true,
} satisfies Prisma.CitySelect;

@Injectable()
export class ReceptionService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchReceptionQueryDto) {
    const scope = query.scope ?? 'primary';
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize =
      query.pageSize && query.pageSize > 0
        ? Math.min(query.pageSize, 100)
        : RECEPTION_SEARCH_PAGE_SIZE;
    if (scope === 'extended') {
      return this.searchExtended(query.q, page, pageSize);
    }
    return this.searchPrimary(query.q, page, pageSize);
  }

  private pageArgs(page: number, pageSize: number) {
    return { skip: (page - 1) * pageSize, take: pageSize };
  }

  private async searchPrimary(q: string, page: number, pageSize: number) {
    const codeQuery = isReservationCodeQuery(q)
      ? normalizeReservationCode(q)
      : '';
    if (codeQuery) {
      return this.searchByReservationCode(q, codeQuery, page, pageSize);
    }

    const where = this.searchWhere(q);
    const reservationWhere = this.reservationSearchWhere(q);
    const digits = normalizeSearchDigits(q);
    const { skip, take } = this.pageArgs(page, pageSize);
    const [userTotal, users, reservations] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
        select: personMatchSelect,
      }),
      page === 1
        ? this.prisma.reservation.findMany({
            where: reservationWhere,
            take: pageSize,
            orderBy: [{ year: 'desc' }, { codeSeq: 'asc' }],
            select: searchReservationSelect,
          })
        : Promise.resolve([]),
    ]);

    const matches = users
      .map((user) => this.toMatch(user))
      .sort((a, b) => this.matchRank(a, q, digits) - this.matchRank(b, q, digits));
    const userIds = new Set(users.map((user) => user.id));
    const extraReservations = reservations.filter(
      (item) => !userIds.has(item.createdById),
    );
    const records = [
      ...matches.map((item) => this.toPersonRecord(item)),
      ...extraReservations.map((item) => this.toReservationRecord(item)),
    ];
    const profile =
      page === 1 && userTotal === 1 && extraReservations.length === 0 && matches[0]
        ? await this.profile(matches[0].id)
        : null;

    return {
      q,
      scope: 'primary' as const,
      page,
      pageSize,
      total: userTotal,
      matches,
      records,
      profile,
    };
  }

  private async searchExtended(q: string, page: number, pageSize: number) {
    const text = containsInsensitive(q);
    const digits = normalizeSearchDigits(q);
    const placeOr: Prisma.AccommodationWhereInput[] = [
      { name: text },
      { phone: text },
      { address: text },
      { city: { nameFa: text } },
      { city: { nameEn: text } },
    ];
    if (digits.length >= 4) {
      placeOr.push({ phone: startsWithInsensitive(digits) });
    }
    const stationOr: Prisma.WalkingStationWhereInput[] = [
      { name: text },
      { address: text },
      { managerName: text },
      { managerPhone: text },
      { manager: { fullName: text } },
      { manager: { phone: text } },
      { city: { nameFa: text } },
      { city: { nameEn: text } },
    ];
    if (digits.length >= 4) {
      stationOr.push({ managerPhone: startsWithInsensitive(digits) });
    }
    const benefactorOr: Prisma.BenefactorWhereInput[] = [
      { name: text },
      { firstName: text },
      { lastName: text },
      { nationalId: text },
      { phone: text },
    ];
    if (digits.length >= 4) {
      benefactorOr.push(
        { nationalId: startsWithInsensitive(digits) },
        { phone: startsWithInsensitive(digits) },
      );
    }
    const honoraryOr: Prisma.HonoraryServiceAnnouncementWhereInput[] = [
      { otherDescription: text },
      { serviceType: { name: text } },
      { user: { fullName: text } },
      { user: { firstName: text } },
      { user: { lastName: text } },
      { user: { nationalId: text } },
      { user: { phone: text } },
    ];

    const caravanOr: Prisma.CaravanWhereInput[] = [
      { name: text },
      { description: text },
      { officeAddress: text },
      { officePhone: text },
      { licenseNumber: text },
      { city: { nameFa: text } },
      { city: { nameEn: text } },
      { manager: { fullName: text } },
    ];
    if (digits.length >= 4) {
      caravanOr.push(
        { officePhone: startsWithInsensitive(digits) },
        { licenseNumber: startsWithInsensitive(digits) },
      );
    }

    const [accommodations, stations, honoraryRows, benefactors, caravans] = await Promise.all([
      this.prisma.accommodation.findMany({
        where: { OR: placeOr },
        take: pageSize,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          phone: true,
          type: true,
          city: { select: searchPlaceCitySelect },
        },
      }),
      this.prisma.walkingStation.findMany({
        where: { OR: stationOr },
        take: pageSize,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          managerName: true,
          managerPhone: true,
          city: { select: searchPlaceCitySelect },
        },
      }),
      this.prisma.honoraryServiceAnnouncement.findMany({
        where: { OR: honoraryOr },
        take: pageSize,
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        select: { userId: true },
      }),
      this.prisma.benefactor.findMany({
        where: { OR: benefactorOr },
        take: pageSize,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          nationalId: true,
          phone: true,
          city: { select: searchPlaceCitySelect },
        },
      }),
      this.prisma.caravan.findMany({
        where: { OR: caravanOr },
        take: pageSize,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          officePhone: true,
          licenseNumber: true,
          city: { select: searchPlaceCitySelect },
        },
      }),
    ]);

    const honoraryUserIds = [...new Set(honoraryRows.map((row) => row.userId))];
    const honoraryUsers = honoraryUserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: honoraryUserIds } },
          take: pageSize,
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
          select: personMatchSelect,
        })
      : [];
    const matches = honoraryUsers.map((user) => this.toMatch(user));
    const records = [
      ...matches.map((item) => this.toPersonRecord(item)),
      ...accommodations.map((item) => ({
        type: 'accommodation' as const,
        id: item.id,
        title: item.name,
        subtitle: item.type,
        phone: item.phone,
        nationalId: null,
        city: item.city,
      })),
      ...stations.map((item) => ({
        type: 'walkingStation' as const,
        id: item.id,
        title: item.name,
        subtitle: item.managerName,
        phone: item.managerPhone,
        nationalId: null,
        city: item.city,
      })),
      ...benefactors.map((item) => ({
        type: 'benefactor' as const,
        id: item.id,
        title: item.name,
        subtitle: null,
        phone: item.phone,
        nationalId: item.nationalId,
        city: item.city,
      })),
      ...caravans.map((item) => ({
        type: 'caravan' as const,
        id: item.id,
        title: item.name,
        subtitle: item.licenseNumber,
        phone: item.officePhone,
        nationalId: null,
        city: item.city,
      })),
    ];
    const profile =
      page === 1 && matches.length === 1 && records.length === 1
        ? await this.profile(matches[0].id)
        : null;

    return {
      q,
      scope: 'extended' as const,
      page,
      pageSize,
      total: records.length,
      matches,
      records,
      profile,
    };
  }

  private async searchByReservationCode(
    q: string,
    codeQuery: string,
    page: number,
    pageSize: number,
  ) {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        OR: [{ code: codeQuery }, { code: { startsWith: codeQuery } }],
      },
      take: pageSize,
      orderBy: [{ year: 'desc' }, { codeSeq: 'asc' }],
      select: { createdById: true, code: true },
    });
    const exact = reservations.find((item) => item.code === codeQuery);
    const userIds = [
      ...new Set(
        (exact ? [exact] : reservations).map((item) => item.createdById),
      ),
    ];
    if (!userIds.length) {
      return {
        q,
        scope: 'primary' as const,
        page,
        pageSize,
        total: 0,
        matches: [],
        records: [],
        profile: null,
      };
    }
    const { skip, take } = this.pageArgs(page, pageSize);
    const [userTotal, users] = await Promise.all([
      this.prisma.user.count({ where: { id: { in: userIds } } }),
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        skip,
        take,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
        select: personMatchSelect,
      }),
    ]);
    const matches = users.map((user) => this.toMatch(user));
    const records = matches.map((item) => this.toPersonRecord(item));
    const profile =
      page === 1 && userTotal === 1 && matches[0]
        ? await this.profile(matches[0].id)
        : null;
    return {
      q,
      scope: 'primary' as const,
      page,
      pageSize,
      total: userTotal,
      matches,
      records,
      profile,
    };
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
        honoraryServiceAnnouncements: {
          select: { serviceType: { select: { code: true, name: true } } },
          take: 8,
        },
        _count: {
          select: {
            reservationMembers: true,
            createdReservations: true,
            managedCaravans: true,
            managedAccommodations: true,
            honoraryAssignments: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('شخص یافت نشد');
    }

    const kinds = this.kindsFor(user.userRoles, user._count);
    const year = currentJalaliYear();

    const [memberships, caravans, caravanReservations, honoraryAssignments, managerRows] =
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
              select: visitReservationSelect,
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
          select: visitReservationSelect,
        }),
        this.prisma.reservationHonoraryAssignment.findMany({
          where: { userId: id },
          orderBy: [
            { reservation: { year: 'desc' } },
            { reservation: { createdAt: 'desc' } },
          ],
          select: {
            reservationId: true,
            reservation: { select: visitReservationSelect },
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

    const hasHonoraryService = this.hasHonoraryService(
      user.honoraryServiceAnnouncements,
      user._count.honoraryAssignments,
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
      hasHonoraryService,
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
    const honoraryVisits = this.uniqueHonoraryVisits(honoraryAssignments);
    const showHonorary = hasHonoraryService || honoraryVisits.length > 0;

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
      honorary: showHonorary
        ? {
            visits: honoraryVisits,
          }
        : null,
    };
  }

  private toMatch(user: Prisma.UserGetPayload<{ select: typeof personMatchSelect }>) {
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
      hasHonoraryService: this.hasHonoraryService(
        user.honoraryServiceAnnouncements,
        user._count.honoraryAssignments,
      ),
    };
  }

  private hasHonoraryService(
    announcements: { serviceType: { code: string | null; name: string } | null }[],
    assignmentCount: number,
  ) {
    if (assignmentCount > 0) return true;
    return announcements.length > 0;
  }

  private uniqueHonoraryVisits(
    assignments: {
      reservationId: string;
      reservation: Prisma.ReservationGetPayload<{
        select: typeof visitReservationSelect;
      }>;
    }[],
  ) {
    const seen = new Set<string>();
    const visits = [];
    for (const item of assignments) {
      if (seen.has(item.reservationId)) continue;
      seen.add(item.reservationId);
      visits.push(this.toVisit(item.reservation));
    }
    return visits;
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
    code: string;
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
    caravan: {
      id: string;
      name: string;
      walkingRoute: { id: string; name: string } | null;
    } | null;
    group: {
      id: string;
      name: string;
      walkingRoute: { id: string; name: string } | null;
    } | null;
  }) {
    return {
      id: reservation.id,
      code: reservation.code,
      year: reservation.year,
      type: reservation.type,
      status: reservation.status,
      stayStartDate: toDateOnly(reservation.stayStartDate),
      stayEndDate: toDateOnly(reservation.stayEndDate),
      walkingStartDate: toDateOnly(reservation.walkingStartDate),
      originCity: reservation.originCity,
      walkingRoute:
        reservation.walkingRoute ??
        reservation.caravan?.walkingRoute ??
        reservation.group?.walkingRoute ??
        null,
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

  private toPersonRecord(item: ReturnType<ReceptionService['toMatch']>) {
    return {
      type: 'person' as const,
      id: item.id,
      title: item.fullName,
      subtitle: null as string | null,
      phone: item.phone,
      nationalId: item.nationalId,
      city: item.city,
      code: null as string | null,
      person: item,
    };
  }

  private toReservationRecord(
    item: Prisma.ReservationGetPayload<{ select: typeof searchReservationSelect }>,
  ) {
    return {
      type: 'reservation' as const,
      id: item.id,
      title: item.code,
      subtitle: item.caravan?.name ?? item.group?.name ?? item.createdBy.fullName,
      phone: null,
      nationalId: null,
      city: null,
      code: item.code,
      year: item.year,
      reservationType: item.type,
      status: item.status,
    };
  }

  private reservationSearchWhere(q: string): Prisma.ReservationWhereInput {
    const text = containsInsensitive(q);
    const digits = normalizeSearchDigits(q);
    const or: Prisma.ReservationWhereInput[] = [
      { code: text },
      { createdBy: { fullName: text } },
      { createdBy: { nationalId: text } },
      { caravan: { name: text } },
      { group: { name: text } },
    ];
    if (digits.length >= 4) {
      or.push(
        { createdBy: { nationalId: startsWithInsensitive(digits) } },
        { createdBy: { phone: startsWithInsensitive(digits) } },
      );
    }
    return { OR: or };
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
