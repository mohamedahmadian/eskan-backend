import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Impersonation } from './decorators/impersonation.decorator';
import { Roles } from './decorators/roles.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ImpersonateDto } from './dto/impersonate.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { APP_LOCALES } from '../users/dto/create-user.dto';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsIn([...APP_LOCALES])
  locale?: string;
}

type RequestUser = { id: string };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('impersonate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  impersonate(
    @CurrentUser() actor: RequestUser,
    @Impersonation() impersonation: { impersonating: boolean },
    @Body() dto: ImpersonateDto,
  ) {
    return this.auth.impersonate(actor.id, dto.userId, impersonation.impersonating);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(
    @CurrentUser() user: RequestUser,
    @Impersonation() impersonation: { actorId: string | null },
  ) {
    return this.auth.profile(user.id, impersonation.actorId);
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: RequestUser,
    @Impersonation() impersonation: { impersonating: boolean },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user.id, dto, impersonation.impersonating);
  }

  @Patch('settings')
  @UseGuards(JwtAuthGuard)
  updateSettings(
    @CurrentUser() user: RequestUser,
    @Impersonation() impersonation: { impersonating: boolean },
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.auth.updateSettings(
      user.id,
      dto.fullName,
      dto.locale,
      impersonation.impersonating,
    );
  }
}
