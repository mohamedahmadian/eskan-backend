import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActivateAllCaravanYearDto } from './dto/activate-all-caravan-year.dto';
import { ActivateCaravanYearDto } from './dto/activate-caravan-year.dto';
import { AddCaravanYearDto } from './dto/add-caravan-year.dto';
import { AssignCaravanYearDto } from './dto/assign-caravan-year.dto';
import { CreateCaravanDto } from './dto/create-caravan.dto';
import { FindCaravanHistoryQueryDto } from './dto/find-caravan-history-query.dto';
import { FindCaravanReportQueryDto } from './dto/find-caravan-report-query.dto';
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

type ExcelUpload = {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
};

function assertExcelUpload(file?: ExcelUpload) {
  if (!file?.buffer?.length) {
    throw new BadRequestException('فایل اکسل انتخاب نشده است');
  }
  const name = file.originalname?.toLowerCase() ?? '';
  if (!name.endsWith('.xlsx')) {
    throw new BadRequestException('فقط فایل اکسل با پسوند xlsx مجاز است');
  }
  return file;
}

const excelUploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024 },
});

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
  @Roles('AUTHENTICATED')
  findMine(
    @Query() query: FindCaravansQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.findMine(query, actor.id);
  }

  @Get('report')
  report(
    @Query() query: FindCaravanReportQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.report(actor, query.year);
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

  @Post('import/preview')
  @UseInterceptors(excelUploadInterceptor)
  previewImport(@UploadedFile() file: ExcelUpload) {
    const upload = assertExcelUpload(file);
    return this.caravans.previewImport(upload.buffer);
  }

  @Post('import')
  @UseInterceptors(excelUploadInterceptor)
  importCaravans(@UploadedFile() file: ExcelUpload) {
    const upload = assertExcelUpload(file);
    return this.caravans.importFromExcel(upload.buffer);
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
  @Roles('AUTHENTICATED')
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

  @Post(':id/years')
  assignYear(
    @Param('id') id: string,
    @Body() dto: AssignCaravanYearDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.assignYear(id, dto.year, dto.managerUserId ?? null, actor, {
      maleCount: dto.maleCount,
      femaleCount: dto.femaleCount,
    });
  }

  @Delete(':id/years/:yearId')
  removeYear(
    @Param('id') id: string,
    @Param('yearId') yearId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.removeYear(id, yearId, actor);
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
