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
import { ActivateAccommodationYearDto } from './dto/activate-accommodation-year.dto';
import { AssignAccommodationManagerDto } from './dto/assign-accommodation-manager.dto';
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { FindAccommodationReportQueryDto } from './dto/find-accommodation-report-query.dto';
import { FindAccommodationsQueryDto } from './dto/find-accommodations-query.dto';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto';
import { AccommodationsService } from './accommodations.service';

type RequestUser = {
  id: string;
  userRoles: { role: { code: string } }[];
};

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

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.accommodations.findOne(id, actor);
  }

  @Post()
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
    return this.accommodations.assignManager(id, dto.userId, dto.year, actor);
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
