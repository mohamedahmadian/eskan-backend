import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { normalizeNationalId, normalizePassportNumber, toLatinDigits } from '../common/national-id';
import { phoneLookupValues } from '../common/phone';
import { Prisma, UserGender, UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { joinFullName, splitFullName } from '../users/user-profile.util';
import {
  canAccessMyAccommodations,
  canAccessMyCaravans,
  canAccessMyEvaluations,
  canAccessMyGroups,
  canAccessMyReservations,
} from './roles.util';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

const IMPERSONATE_TOKEN_TTL = '2h';

const retiredMenuCodes = new Set([
  'base-info.medical-centers',
  'base-info.red-crescents',
  'dashboard.honorary-apply',
]);
const retiredMenuNameKeys = new Set(['menus.medicalCenters', 'menus.redCrescents']);

const userWithRoles = {
  userRoles: { include: { role: true } },
  issuingOrganization: { select: { id: true, name: true, phone: true } },
} as const;

type AuthUserRecord = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  locale: string;
  status: UserStatus;
  gender: UserGender | null;
  countryId: string | null;
  provinceId: string | null;
  cityId: string | null;
  issuingOrganization: { id: string; name: string; phone: string | null } | null;
  userRoles: {
    role: { id: string; code: string; nameKey: string };
  }[];
};

type ProfileExtras = {
  impersonating?: boolean;
  impersonatedBy?: { id: string; fullName: string } | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const identifier = toLatinDigits(dto.username.trim());
    const password = toLatinDigits(dto.password);
    const nationalId = normalizeNationalId(identifier);
    const passport = normalizePassportNumber(identifier);
    const email = identifier.includes('@') ? identifier.toLowerCase() : '';
    const or: Prisma.UserWhereInput[] = [{ username: identifier }];
    if (nationalId) {
      or.push({ nationalId });
    }
    if (passport && passport !== nationalId) {
      or.push({ nationalId: passport });
    }
    for (const phone of phoneLookupValues(identifier)) {
      or.push({ phone });
    }
    if (email) {
      or.push({ email });
    }
    const user = await this.prisma.user.findFirst({
      where: { OR: or },
      include: userWithRoles,
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('نام کاربری یا رمز عبور نادرست است');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('نام کاربری یا رمز عبور نادرست است');
    }

    let profileUser: AuthUserRecord = user;
    if (dto.locale && dto.locale !== user.locale) {
      profileUser = await this.prisma.user.update({
        where: { id: user.id },
        data: { locale: dto.locale },
        include: userWithRoles,
      });
    }

    const token = await this.jwt.signAsync({
      sub: profileUser.id,
      roles: profileUser.userRoles.map((item) => item.role.code),
    });

    return {
      token,
      user: await this.toProfile(profileUser),
    };
  }

  async profile(userId: string, impersonatedById?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userWithRoles,
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.toProfile(user, await this.impersonationExtras(impersonatedById));
  }

  async impersonate(actorId: string, targetUserId: string, alreadyImpersonating: boolean) {
    if (alreadyImpersonating) {
      throw new ForbiddenException('در حالت مشاهده پنل کاربر نمی‌توان دوباره وارد شد');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: userWithRoles,
    });

    if (!target) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    if (target.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('ورود به پنل کاربر غیرفعال ممکن نیست');
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, fullName: true },
    });

    this.logger.log(`Admin ${actorId} opened user panel as ${target.id}`);

    const token = await this.jwt.signAsync(
      {
        sub: target.id,
        roles: target.userRoles.map((item) => item.role.code),
        act: actorId,
        impersonating: true,
      },
      { expiresIn: IMPERSONATE_TOKEN_TTL },
    );

    return {
      token,
      user: await this.toProfile(target, {
        impersonating: true,
        impersonatedBy: actor,
      }),
    };
  }

  assertNotImpersonating(impersonating: boolean) {
    if (impersonating) {
      throw new ForbiddenException('این عملیات در حالت مشاهده پنل کاربر مجاز نیست');
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto, impersonating = false) {
    this.assertNotImpersonating(impersonating);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }

    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('رمز عبور فعلی نادرست است');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { ok: true };
  }

  async updateSettings(
    userId: string,
    fullName?: string,
    locale?: string,
    impersonating = false,
  ) {
    this.assertNotImpersonating(impersonating);
    const names = fullName ? splitFullName(fullName) : undefined;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(names
          ? {
              firstName: names.firstName,
              lastName: names.lastName,
              fullName: joinFullName(names.firstName, names.lastName),
            }
          : {}),
        ...(locale ? { locale } : {}),
      },
      include: userWithRoles,
    });

    return this.toProfile(user);
  }

  private async impersonationExtras(
    impersonatedById?: string | null,
  ): Promise<ProfileExtras | undefined> {
    if (!impersonatedById) return undefined;
    const actor = await this.prisma.user.findUnique({
      where: { id: impersonatedById },
      select: { id: true, fullName: true },
    });
    return {
      impersonating: true,
      impersonatedBy: actor,
    };
  }

  private async toProfile(user: AuthUserRecord, extras?: ProfileExtras) {
    const [roleMenus, groupCount, accommodationCount, starterMenus, announcements] =
      await Promise.all([
        user.userRoles.length
          ? this.prisma.roleMenu.findMany({
              where: { roleId: { in: user.userRoles.map((item) => item.role.id) } },
              include: {
                menu: { include: { module: true } },
              },
            })
          : Promise.resolve([]),
        this.prisma.group.count({ where: { managerUserId: user.id } }),
        this.prisma.accommodationManager.count({ where: { userId: user.id } }),
        user.userRoles.length
          ? Promise.resolve([])
          : this.prisma.menu.findMany({
              where: {
                code: {
                  in: [
                    'dashboard.overview',
                    'honorary-service.apply',
                    'honorary-service.history',
                    'reservations.mine',
                  ],
                },
              },
              include: { module: true },
            }),
        this.prisma.honoraryServiceAnnouncement.findMany({
          where: { userId: user.id },
          include: {
            serviceType: { select: { id: true, name: true, code: true } },
          },
          orderBy: { startDate: 'desc' },
        }),
      ]);
    const accessUser = {
      ...user,
      hasGroup: groupCount > 0,
      managesAccommodation: accommodationCount > 0,
    };

    const honoraryServices: { id: string; name: string; code: string | null }[] =
      [];
    const seenTypes = new Set<string>();
    for (const item of announcements) {
      if (item.serviceType) {
        if (seenTypes.has(item.serviceType.id)) continue;
        seenTypes.add(item.serviceType.id);
        honoraryServices.push({
          id: item.serviceType.id,
          name: item.serviceType.name,
          code: item.serviceType.code,
        });
      } else if (item.otherDescription?.trim()) {
        const key = `other:${item.otherDescription.trim()}`;
        if (seenTypes.has(key)) continue;
        seenTypes.add(key);
        honoraryServices.push({
          id: item.id,
          name: item.otherDescription.trim(),
          code: null,
        });
      }
    }
    const hasHonoraryService = honoraryServices.length > 0;

    const modulesMap = new Map<
      string,
      {
        code: string;
        nameKey: string;
        icon: string;
        sortOrder: number;
        menus: {
          code: string;
          nameKey: string;
          path: string;
          icon: string;
          sortOrder: number;
        }[];
      }
    >();

    const addMenu = (menu: {
      code: string;
      nameKey: string;
      path: string;
      icon: string;
      sortOrder: number;
      module: {
        code: string;
        nameKey: string;
        icon: string;
        sortOrder: number;
      };
    }) => {
      if (retiredMenuCodes.has(menu.code) || retiredMenuNameKeys.has(menu.nameKey)) {
        return;
      }
      if (menu.code === 'caravans.mine' && !canAccessMyCaravans(accessUser)) {
        return;
      }
      if (menu.code === 'groups.mine' && !canAccessMyGroups(accessUser)) {
        return;
      }
      if (
        (menu.code === 'reservations.mine' || menu.code === 'reservations.create') &&
        !canAccessMyReservations(accessUser)
      ) {
        return;
      }
      if (menu.code === 'accommodation.mine' && !canAccessMyAccommodations(accessUser)) {
        return;
      }
      if (menu.code === 'evaluations.mine' && !canAccessMyEvaluations(accessUser)) {
        return;
      }
      if (menu.code === 'reservations.translator' && !hasHonoraryService) {
        return;
      }
      const mod = menu.module;
      if (!modulesMap.has(mod.code)) {
        modulesMap.set(mod.code, {
          code: mod.code,
          nameKey: mod.nameKey,
          icon: mod.icon,
          sortOrder: mod.sortOrder,
          menus: [],
        });
      }
      const current = modulesMap.get(mod.code);
      if (!current.menus.some((item) => item.code === menu.code)) {
        current.menus.push({
          code: menu.code,
          nameKey: menu.nameKey,
          path: menu.path,
          icon: menu.icon,
          sortOrder: menu.sortOrder,
        });
      }
    };

    for (const item of roleMenus) {
      addMenu(item.menu);
    }
    for (const menu of starterMenus) {
      addMenu(menu);
    }

    const modules = [...modulesMap.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((mod) => ({
        ...mod,
        menus: mod.menus.sort((a, b) => a.sortOrder - b.sortOrder),
      }));

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      locale: user.locale,
      gender: user.gender,
      countryId: user.countryId,
      provinceId: user.provinceId,
      cityId: user.cityId,
      issuingOrganization: user.issuingOrganization,
      roles: user.userRoles.map((item) => ({
        code: item.role.code,
        nameKey: item.role.nameKey,
      })),
      hasGroup: accessUser.hasGroup,
      managesAccommodation: accessUser.managesAccommodation,
      honoraryServices,
      modules,
      impersonating: extras?.impersonating ?? false,
      impersonatedBy: extras?.impersonatedBy ?? null,
    };
  }
}
