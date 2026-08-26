import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActivateAccommodationYearDto } from './dto/activate-accommodation-year.dto';
import { ActivateAllAccommodationYearDto } from './dto/activate-all-accommodation-year.dto';
import { AddAccommodationYearDto } from './dto/add-accommodation-year.dto';
import { AssignAccommodationManagerDto } from './dto/assign-accommodation-manager.dto';
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { FindAccommodationReportQueryDto } from './dto/find-accommodation-report-query.dto';
import { FindAccommodationsQueryDto } from './dto/find-accommodations-query.dto';
import { FindYearManagementQueryDto } from './dto/find-year-management-query.dto';
import { SetAccommodationYearContactsDto } from './dto/set-accommodation-year-contacts.dto';
import { TransferAccommodationsYearDto } from './dto/transfer-accommodations-year.dto';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto';
import { AccommodationsService } from './accommodations.service';

type RequestUser = {
  id: string;
  userRoles: { role: { code: string } }[];
};

const mineRoles = [
  'ADMIN',
  'ACCOMMODATION_MANAGER',
  'CARAVAN_MANAGER',
  'GROUP_MANAGER',
  'PILGRIM',
  'HEADQUARTERS_REPRESENTATIVE',
] as const;

@Controller('accommodations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'ACCOMMODATION_MANAGER')
export class AccommodationsController {
  constructor(private readonly accommodations: AccommodationsService) {}

  @Get()
  findAll(
    @Query() query: FindAccommodationsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.findAll(query, actor);
  }

  @Get('mine')
  @Roles(...mineRoles)
  findMine(
    @Query() query: FindAccommodationsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.findMine(query, actor);
  }

  @Get('report')
  report(
    @Query() query: FindAccommodationReportQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.report(actor, query.year);
  }

  @Get('export')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    "attachment; filename=\"accommodations.xlsx\"; filename*=UTF-8''%D8%A7%D8%B3%DA%A9%D8%A7%D9%86%E2%80%8C%D9%87%D8%A7.xlsx",
  )
  async export(
    @Query() query: FindAccommodationsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const buffer = await this.accommodations.exportExcel(query, actor);
    return new StreamableFile(buffer);
  }

  @Get('year-management/stats')
  @Roles('ADMIN')
  yearStats(
    @Query() query: FindAccommodationReportQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.yearStats(actor, query.year);
  }

  @Get('year-management/list')
  @Roles('ADMIN')
  findYearList(
    @Query() query: FindYearManagementQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.findYearList(query, actor);
  }

  @Get('year-management/active')
  @Roles('ADMIN')
  findActiveInYear(
    @Query() query: FindYearManagementQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.findActiveInYear(query, actor);
  }

  @Get('year-management/inactive')
  @Roles('ADMIN')
  findInactiveInYear(
    @Query() query: FindYearManagementQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.findInactiveInYear(query, actor);
  }

  @Post('year-management/add')
  @Roles('ADMIN')
  addToYear(
    @Body() dto: AddAccommodationYearDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.addToYear(dto.accommodationId, actor, dto.year);
  }

  @Post('year-management/activate-all')
  @Roles('ADMIN')
  activateAllInactive(
    @Body() dto: ActivateAllAccommodationYearDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.activateAllInactive(actor, dto.year);
  }

  @Post('year-management/deactivate-all')
  @Roles('ADMIN')
  deactivateAllActive(
    @Body() dto: ActivateAllAccommodationYearDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.deactivateAllActive(actor, dto.year);
  }

  @Post('year-management/transfer')
  @Roles('ADMIN')
  transferYears(
    @Body() dto: TransferAccommodationsYearDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.transferYears(dto, actor);
  }

  @Delete('year-management/:accommodationId')
  @Roles('ADMIN')
  removeFromYear(
    @Param('accommodationId') accommodationId: string,
    @Query() query: FindAccommodationReportQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.removeFromYear(accommodationId, actor, query.year);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.accommodations.findOne(id, actor);
  }

  @Post()
  @Roles(...mineRoles)
  create(
    @Body() dto: CreateAccommodationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.create(dto, actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAccommodationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.update(id, dto, actor);
  }

  @Put(':id/year-contacts')
  setYearContacts(
    @Param('id') id: string,
    @Body() dto: SetAccommodationYearContactsDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.setYearContacts(id, dto, actor);
  }

  @Post(':id/activate-year')
  activateYear(
    @Param('id') id: string,
    @Body() dto: ActivateAccommodationYearDto = {},
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.activateYear(id, actor, dto.year, dto.copyPreviousManager);
  }

  @Post(':id/managers')
  @Roles('ADMIN')
  assignManager(
    @Param('id') id: string,
    @Body() dto: AssignAccommodationManagerDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.assignManager(
      id,
      dto.userId ?? null,
      dto.year,
      actor,
      {
        maleCapacity: dto.maleCapacity,
        femaleCapacity: dto.femaleCapacity,
      },
    );
  }

  @Delete(':id/managers/:assignmentId')
  @Roles('ADMIN')
  unassignManager(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.unassignManager(id, assignmentId, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.accommodations.remove(id, actor);
  }
}
