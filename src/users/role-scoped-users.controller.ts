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
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { AssignAccommodationDto } from './dto/assign-accommodation.dto';
import { AssignHeadquartersCityDto, AssignHeadquartersProvinceDto } from './dto/assign-headquarters-area.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

type RequestUser = { id: string };

abstract class RoleScopedUsersController {
  protected abstract readonly roleCode: string;
  protected abstract readonly notFoundMessage: string;

  constructor(protected readonly users: UsersService) {}

  findAll(query: FindUsersQueryDto) {
    return this.users.findAll({ ...query, roleCode: this.roleCode });
  }

  findOne(id: string) {
    return this.users.assertHasRole(id, this.roleCode, this.notFoundMessage);
  }

  create(dto: CreateUserDto) {
    return this.users.createWithRole(dto, this.roleCode);
  }

  async update(id: string, dto: UpdateUserDto) {
    return this.users.updateKeepingRole(id, dto, this.roleCode);
  }

  async remove(id: string, actor: RequestUser) {
    await this.users.assertHasRole(id, this.roleCode, this.notFoundMessage);
    return this.users.removeRole(id, this.roleCode, actor.id);
  }
}

@Controller('pilgrims')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PilgrimsUsersController extends RoleScopedUsersController {
  protected readonly roleCode = 'PILGRIM';
  protected readonly notFoundMessage = 'زائر یافت نشد';

  constructor(users: UsersService) {
    super(users);
  }

  @Get()
  override findAll(@Query() query: FindUsersQueryDto) {
    return super.findAll(query);
  }

  @Get(':id')
  override findOne(@Param('id') id: string) {
    return super.findOne(id);
  }

  @Post()
  override create(@Body() dto: CreateUserDto) {
    return super.create(dto);
  }

  @Patch(':id')
  override update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return super.update(id, dto);
  }

  @Delete(':id')
  override remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return super.remove(id, actor);
  }
}

@Controller('caravan-managers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CaravanManagersController extends RoleScopedUsersController {
  protected readonly roleCode = 'CARAVAN_MANAGER';
  protected readonly notFoundMessage = 'مدیر کاروان یافت نشد';

  constructor(users: UsersService) {
    super(users);
  }

  @Get()
  override findAll(@Query() query: FindUsersQueryDto) {
    return super.findAll(query);
  }

  @Get(':id')
  override findOne(@Param('id') id: string) {
    return super.findOne(id);
  }

  @Post()
  override create(@Body() dto: CreateUserDto) {
    return super.create(dto);
  }

  @Patch(':id')
  override update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return super.update(id, dto);
  }

  @Delete(':id')
  override remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return super.remove(id, actor);
  }
}

@Controller('accommodation-managers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AccommodationManagersController extends RoleScopedUsersController {
  protected readonly roleCode = 'ACCOMMODATION_MANAGER';
  protected readonly notFoundMessage = 'مدیر اسکان یافت نشد';

  constructor(users: UsersService) {
    super(users);
  }

  @Get()
  override findAll(@Query() query: FindUsersQueryDto) {
    return super.findAll(query);
  }

  @Get(':id')
  override findOne(@Param('id') id: string) {
    return super.findOne(id);
  }

  @Post()
  override create(@Body() dto: CreateUserDto) {
    return super.create(dto);
  }

  @Patch(':id')
  override update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return super.update(id, dto);
  }

  @Post(':id/accommodations')
  assignAccommodation(@Param('id') id: string, @Body() dto: AssignAccommodationDto) {
    return this.users.assignAccommodation(id, dto.accommodationId, dto.year);
  }

  @Delete(':id/accommodations/:assignmentId')
  unassignAccommodation(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.users.unassignAccommodation(id, assignmentId);
  }

  @Delete(':id')
  override remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return super.remove(id, actor);
  }
}

@Controller('headquarters-representatives')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class HeadquartersRepresentativesController extends RoleScopedUsersController {
  protected readonly roleCode = 'HEADQUARTERS_REPRESENTATIVE';
  protected readonly notFoundMessage = 'نماینده ستاد یافت نشد';

  constructor(users: UsersService) {
    super(users);
  }

  @Get()
  override findAll(@Query() query: FindUsersQueryDto) {
    return super.findAll(query);
  }

  @Get(':id')
  override findOne(@Param('id') id: string) {
    return super.findOne(id);
  }

  @Post()
  override create(@Body() dto: CreateUserDto) {
    return super.create(dto);
  }

  @Patch(':id')
  override update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return super.update(id, dto);
  }

  @Post(':id/provinces')
  assignProvince(@Param('id') id: string, @Body() dto: AssignHeadquartersProvinceDto) {
    return this.users.assignProvince(id, dto.provinceId);
  }

  @Delete(':id/provinces/:provinceId')
  unassignProvince(@Param('id') id: string, @Param('provinceId') provinceId: string) {
    return this.users.unassignProvince(id, provinceId);
  }

  @Post(':id/cities')
  assignCity(@Param('id') id: string, @Body() dto: AssignHeadquartersCityDto) {
    return this.users.assignCity(id, dto.cityId);
  }

  @Delete(':id/cities/:cityId')
  unassignCity(@Param('id') id: string, @Param('cityId') cityId: string) {
    return this.users.unassignCity(id, cityId);
  }

  @Delete(':id')
  override remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return super.remove(id, actor);
  }
}
