import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssignAccommodationManagerDto } from './dto/assign-accommodation-manager.dto';
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { FindAccommodationAssignmentsQueryDto } from './dto/find-accommodation-assignments-query.dto';
import { FindAccommodationReportQueryDto } from './dto/find-accommodation-report-query.dto';
import { FindAccommodationsQueryDto } from './dto/find-accommodations-query.dto';
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

  @Get('introduced')
  @Roles('AUTHENTICATED')
  findIntroduced(
    @Query() query: FindAccommodationsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.findIntroduced(query, actor);
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

  @Get('assignments/stats')
  @Roles('ADMIN')
  assignmentStats(@CurrentUser() actor: RequestUser) {
    return this.accommodations.assignmentStats(actor);
  }

  @Get('assignments')
  @Roles('ADMIN')
  findAssignments(
    @Query() query: FindAccommodationAssignmentsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.findAssignments(query, actor);
  }

  @Get(':id/year-caravan-placements')
  findYearCaravanPlacements(
    @Param('id') id: string,
    @Query() query: FindAccommodationReportQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.findYearCaravanPlacements(id, actor, query.year);
  }

  @Get(':id/year-reservations')
  findYearReservations(
    @Param('id') id: string,
    @Query() query: FindAccommodationReportQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.findYearReservations(id, actor, query.year);
  }

  @Get(':id')
  @Roles(...mineRoles)
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

  @Post('introduce')
  @Roles('AUTHENTICATED')
  introduce(
    @Body() dto: CreateAccommodationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.introduce(dto, actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAccommodationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.update(id, dto, actor);
  }

  @Post(':id/managers')
  @Roles('ADMIN')
  assignManager(
    @Param('id') id: string,
    @Body() dto: AssignAccommodationManagerDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.assignManager(id, dto.userId, actor);
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
