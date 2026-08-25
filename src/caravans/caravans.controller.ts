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
import { ActivateAllCaravanYearDto } from './dto/activate-all-caravan-year.dto';
import { ActivateCaravanYearDto } from './dto/activate-caravan-year.dto';
import { AddCaravanYearDto } from './dto/add-caravan-year.dto';
import { CreateCaravanDto } from './dto/create-caravan.dto';
import { FindCaravanHistoryQueryDto } from './dto/find-caravan-history-query.dto';
import { FindCaravanYearQueryDto } from './dto/find-caravan-year-query.dto';
import { FindCaravansQueryDto } from './dto/find-caravans-query.dto';
import { FindYearManagementQueryDto } from './dto/find-year-management-query.dto';
import { TransferCaravansYearDto } from './dto/transfer-caravans-year.dto';
import { UpdateCaravanDto } from './dto/update-caravan.dto';
import { CaravansService } from './caravans.service';

type RequestUser = {
  id: string;
  userRoles?: { role: { code: string } }[];
};

const mineRoles = ['ADMIN', 'CARAVAN_MANAGER', 'PILGRIM'] as const;

@Controller('caravans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CaravansController {
  constructor(private readonly caravans: CaravansService) {}

  @Get()
  findAll(@Query() query: FindCaravansQueryDto) {
    return this.caravans.findAll(query);
  }

  @Get('mine')
  @Roles(...mineRoles)
  findMine(
    @Query() query: FindCaravansQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.findMine(query, actor.id);
  }

  @Get('year-management/stats')
  yearStats(
    @Query() query: FindCaravanYearQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.yearStats(actor, query.year);
  }

  @Get('year-management/list')
  findYearList(
    @Query() query: FindYearManagementQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.findYearList(query, actor);
  }

  @Get('year-management/active')
  findActiveInYear(
    @Query() query: FindYearManagementQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.findActiveInYear(query, actor);
  }

  @Get('year-management/inactive')
  findInactiveInYear(
    @Query() query: FindYearManagementQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.findInactiveInYear(query, actor);
  }

  @Post('year-management/add')
  addToYear(
    @Body() dto: AddCaravanYearDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.addToYear(dto.caravanId, actor, dto.year);
  }

  @Post('year-management/activate-all')
  activateAllInactive(
    @Body() dto: ActivateAllCaravanYearDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.activateAllInactive(actor, dto.year);
  }

  @Post('year-management/deactivate-all')
  deactivateAllActive(
    @Body() dto: ActivateAllCaravanYearDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.deactivateAllActive(actor, dto.year);
  }

  @Post('year-management/transfer')
  transferYears(
    @Body() dto: TransferCaravansYearDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.transferYears(dto, actor);
  }

  @Delete('year-management/:caravanId')
  removeFromYear(
    @Param('caravanId') caravanId: string,
    @Query() query: FindCaravanYearQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.removeFromYear(caravanId, actor, query.year);
  }

  @Get(':id/pilgrimage-history')
  @Roles(...mineRoles)
  pilgrimageHistory(
    @Param('id') id: string,
    @Query() query: FindCaravanHistoryQueryDto,
  ) {
    return this.caravans.findPilgrimageHistory(id, query);
  }

  @Get(':id')
  @Roles(...mineRoles)
  findOne(@Param('id') id: string) {
    return this.caravans.findOne(id);
  }

  @Post()
  @Roles(...mineRoles)
  create(@Body() dto: CreateCaravanDto, @CurrentUser() actor: RequestUser) {
    return this.caravans.create(dto, actor);
  }

  @Post(':id/activate-year')
  @Roles(...mineRoles)
  activateYear(
    @Param('id') id: string,
    @Body() dto: ActivateCaravanYearDto = {},
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.activateYear(id, actor, dto.year, dto.copyPreviousManager);
  }

  @Patch(':id')
  @Roles(...mineRoles)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCaravanDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.update(id, dto, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.caravans.remove(id);
  }
}
