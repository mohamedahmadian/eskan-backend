import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CheckIdentityDto } from './dto/check-identity.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

type RequestUser = { id: string };

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: RequestUser) {
    return this.users.findOne(user.id);
  }

  @Post('identity-check')
  checkIdentity(
    @CurrentUser() user: RequestUser,
    @Body() dto: CheckIdentityDto,
  ) {
    return this.users.checkIdentityTaken({
      nationalId: dto.nationalId,
      phone: dto.phone,
      username: dto.username,
      excludeId: user.id,
    });
  }

  @Patch()
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateUserDto) {
    return this.users.updateOwnAccount(user.id, dto);
  }
}
