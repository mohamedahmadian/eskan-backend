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
import { CaravanCreateQuotaQueryDto } from './dto/caravan-create-quota-query.dto';
import { CreateCaravanDto } from './dto/create-caravan.dto';
import { FindCaravanHistoryQueryDto } from './dto/find-caravan-history-query.dto';
import { FindCaravanReportQueryDto } from './dto/find-caravan-report-query.dto';
import {
  FindCaravansQueryDto,
  FindMineCaravansQueryDto,
} from './dto/find-caravans-query.dto';
import { UpdateCaravanDto } from './dto/update-caravan.dto';
import { CaravansService } from './caravans.service';

type RequestUser = {
  id: string;
  userRoles?: { role: { code: string } }[];
};

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
    @Query() query: FindMineCaravansQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.findMine(query, actor);
  }

  @Get('create-quota')
  @Roles('AUTHENTICATED')
  createQuota(
    @Query() query: CaravanCreateQuotaQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.createQuota(actor, query.managerUserId);
  }

  @Get('report')
  report(
    @Query() query: FindCaravanReportQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.report(actor, query.year);
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

  @Get(':id/placements')
  @Roles('AUTHENTICATED')
  placements(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.caravans.findYearPlacements(id, actor);
  }

  @Get(':id/pilgrimage-history')
  @Roles('AUTHENTICATED')
  pilgrimageHistory(
    @Param('id') id: string,
    @Query() query: FindCaravanHistoryQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.findPilgrimageHistory(id, query, actor);
  }

  @Get(':id')
  @Roles('AUTHENTICATED')
  findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.caravans.findOne(id, actor);
  }

  @Post()
  @Roles('AUTHENTICATED')
  create(@Body() dto: CreateCaravanDto, @CurrentUser() actor: RequestUser) {
    return this.caravans.create(dto, actor);
  }

  @Post('register')
  @Roles('AUTHENTICATED')
  register(@Body() dto: CreateCaravanDto, @CurrentUser() actor: RequestUser) {
    return this.caravans.register(dto, actor);
  }

  @Patch(':id')
  @Roles('AUTHENTICATED')
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
