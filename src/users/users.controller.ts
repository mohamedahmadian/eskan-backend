import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CheckIdentityDto } from './dto/check-identity.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { SetUserPasswordDto } from './dto/set-user-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

type RequestUser = { id: string };

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  findAll(@Query() query: FindUsersQueryDto) {
    return this.users.findAll(query);
  }

  @Post('identity-check')
  checkIdentity(@Body() dto: CheckIdentityDto) {
    return this.users.checkIdentityTaken(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Post(':id/password/recover')
  resetPassword(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.users.resetUserPasswordAndSms(id, actor.id);
  }

  @Patch(':id/password')
  setPassword(
    @Param('id') id: string,
    @Body() dto: SetUserPasswordDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.users.setUserPasswordAndSms(id, dto, actor.id);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.users.remove(id, actor.id);
  }
}
