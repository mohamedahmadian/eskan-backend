import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { joinFullName, splitFullName } from '../users/user-profile.util';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

const userWithRoles = {
  userRoles: { include: { role: true } },
} as const;

type AuthUserRecord = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  locale: string;
  status: UserStatus;
  countryId: string | null;
  provinceId: string | null;
  cityId: string | null;
  userRoles: {
    role: { id: string; code: string; nameKey: string };
  }[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const identifier = dto.username.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { nationalId: identifier },
          { phone: identifier },
        ],
      },
      include: userWithRoles,
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('نام کاربری یا رمز عبور نادرست است');
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('نام کاربری یا رمز عبور نادرست است');
    }

    const token = await this.jwt.signAsync({
      sub: user.id,
      roles: user.userRoles.map((item) => item.role.code),
    });

    return {
      token,
      user: await this.toProfile(user),
    };
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userWithRoles,
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return this.toProfile(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
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

  async updateSettings(userId: string, fullName?: string, locale?: string) {
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

  private async toProfile(user: AuthUserRecord) {
    const roleIds = user.userRoles.map((item) => item.role.id);
    const roleMenus = roleIds.length
      ? await this.prisma.roleMenu.findMany({
          where: { roleId: { in: roleIds } },
          include: {
            menu: { include: { module: true } },
          },
        })
      : [];

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

    for (const item of roleMenus) {
      const mod = item.menu.module;
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
      if (!current.menus.some((menu) => menu.code === item.menu.code)) {
        current.menus.push({
          code: item.menu.code,
          nameKey: item.menu.nameKey,
          path: item.menu.path,
          icon: item.menu.icon,
          sortOrder: item.menu.sortOrder,
        });
      }
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
      countryId: user.countryId,
      provinceId: user.provinceId,
      cityId: user.cityId,
      roles: user.userRoles.map((item) => ({
        code: item.role.code,
        nameKey: item.role.nameKey,
      })),
      modules,
    };
  }
}
