import {
  BadRequestException,
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
import { CreateUserDto } from './dto/create-user.dto';
import { FindPilgrimHistoryQueryDto } from './dto/find-pilgrim-history-query.dto';
import {
  FindPilgrimReportCityTimelineQueryDto,
  FindPilgrimReportExportQueryDto,
  FindPilgrimReportProvinceTimelineQueryDto,
  FindPilgrimReportQueryDto,
} from './dto/find-pilgrim-report-query.dto';
import { FindLocationHistoryQueryDto } from './dto/find-location-history-query.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { AssignAccommodationDto } from './dto/assign-accommodation.dto';
import { AssignHeadquartersCityDto, AssignHeadquartersProvinceDto } from './dto/assign-headquarters-area.dto';
import { CheckIdentityDto } from './dto/check-identity.dto';
import { SetPilgrimPasswordDto } from './dto/set-pilgrim-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserLocationDto } from './dto/update-user-location.dto';
import { UsersService } from './users.service';

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

  async updateLocation(id: string, dto: UpdateUserLocationDto) {
    await this.users.assertHasRole(id, this.roleCode, this.notFoundMessage);
    return this.users.updateLocation(id, dto);
  }

  async findLocationHistory(id: string, query: FindLocationHistoryQueryDto) {
    await this.users.assertHasRole(id, this.roleCode, this.notFoundMessage);
    return this.users.findLocationHistory(id, query);
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

  @Get('report/summary')
  reportSummary(@Query() query: FindPilgrimReportQueryDto) {
    return this.users.pilgrimReportSummary(query.year);
  }

  @Get('report/geo')
  reportGeo(@Query() query: FindPilgrimReportQueryDto) {
    return this.users.pilgrimReportGeo(query.year);
  }

  @Get('report/timeline')
  reportTimeline(@Query() query: FindPilgrimReportQueryDto) {
    return this.users.pilgrimReportTimeline(query.year);
  }

  @Get('report/province-timeline')
  reportProvinceTimeline(
    @Query() query: FindPilgrimReportProvinceTimelineQueryDto,
  ) {
    return this.users.pilgrimReportProvinceTimeline(query.provinceId);
  }

  @Get('report/province-timeline/export')
  async exportProvinceTimeline(
    @Query() query: FindPilgrimReportProvinceTimelineQueryDto,
  ) {
    const { buffer, filename } =
      await this.users.exportPilgrimReportProvinceTimeline(query.provinceId);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get('report/city-timeline')
  reportCityTimeline(@Query() query: FindPilgrimReportCityTimelineQueryDto) {
    return this.users.pilgrimReportCityTimeline(query.cityId);
  }

  @Get('report/city-timeline/export')
  async exportCityTimeline(@Query() query: FindPilgrimReportCityTimelineQueryDto) {
    const { buffer, filename } = await this.users.exportPilgrimReportCityTimeline(
      query.cityId,
    );
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get('report/export')
  async exportReport(@Query() query: FindPilgrimReportExportQueryDto) {
    const { buffer, filename } = await this.users.exportPilgrimReport(
      query.section,
      query.year,
    );
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get('report')
  report(@Query() query: FindPilgrimReportQueryDto) {
    return this.users.pilgrimReport(query.year);
  }

  @Get('export')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    "attachment; filename=\"pilgrims.xlsx\"; filename*=UTF-8''%D8%B2%D8%A7%D8%A6%D8%B1%D8%A7%D9%86.xlsx",
  )
  async export(@Query() query: FindUsersQueryDto) {
    const buffer = await this.users.exportExcel({
      ...query,
      roleCode: this.roleCode,
    });
    return new StreamableFile(buffer);
  }

  @Post('identity-check')
  checkIdentity(@Body() dto: CheckIdentityDto) {
    return this.users.checkIdentityTaken(dto);
  }

  @Post('identity-lookup')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  lookupIdentity(@Body() dto: CheckIdentityDto) {
    return this.users.findByIdentity(dto);
  }

  @Post('me/password/recover')
  @Roles('PILGRIM')
  recoverOwnPassword(@CurrentUser() actor: RequestUser) {
    return this.users.recoverOwnPilgrimPassword(actor.id);
  }

  @Post('import/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 64 * 1024 * 1024 },
    }),
  )
  previewImport(@UploadedFile() file: ExcelUpload) {
    const upload = assertExcelUpload(file);
    return this.users.previewPilgrimImport(upload.buffer);
  }

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 64 * 1024 * 1024 },
    }),
  )
  importPilgrims(@UploadedFile() file: ExcelUpload) {
    const upload = assertExcelUpload(file);
    return this.users.importPilgrimsFromExcel(upload.buffer);
  }

  @Get(':id/pilgrimage-history')
  pilgrimageHistory(
    @Param('id') id: string,
    @Query() query: FindPilgrimHistoryQueryDto,
  ) {
    return this.users.findPilgrimageHistory(id, query);
  }

  @Get(':id')
  override findOne(@Param('id') id: string) {
    return super.findOne(id);
  }

  @Post()
  override create(@Body() dto: CreateUserDto) {
    return super.create(dto);
  }

  @Post(':id/password/recover')
  resetPassword(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.users.resetPilgrimPasswordAndSms(id, actor.id);
  }

  @Patch(':id/password')
  setPassword(
    @Param('id') id: string,
    @Body() dto: SetPilgrimPasswordDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.users.setPilgrimPassword(id, dto, actor.id);
  }

  @Get(':id/location-history')
  locationHistory(
    @Param('id') id: string,
    @Query() query: FindLocationHistoryQueryDto,
  ) {
    return super.findLocationHistory(id, query);
  }

  @Patch(':id/location')
  updateLocation(@Param('id') id: string, @Body() dto: UpdateUserLocationDto) {
    return super.updateLocation(id, dto);
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

  @Post('identity-check')
  checkIdentity(@Body() dto: CheckIdentityDto) {
    return this.users.checkIdentityTaken(dto);
  }

  @Get(':id')
  override findOne(@Param('id') id: string) {
    return super.findOne(id);
  }

  @Post()
  override create(@Body() dto: CreateUserDto) {
    return super.create(dto);
  }

  @Get(':id/location-history')
  locationHistory(
    @Param('id') id: string,
    @Query() query: FindLocationHistoryQueryDto,
  ) {
    return super.findLocationHistory(id, query);
  }

  @Patch(':id/location')
  updateLocation(@Param('id') id: string, @Body() dto: UpdateUserLocationDto) {
    return super.updateLocation(id, dto);
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

  @Post('identity-check')
  checkIdentity(@Body() dto: CheckIdentityDto) {
    return this.users.checkIdentityTaken(dto);
  }

  @Get(':id')
  override findOne(@Param('id') id: string) {
    return super.findOne(id);
  }

  @Post()
  override create(@Body() dto: CreateUserDto) {
    return super.create(dto);
  }

  @Get(':id/location-history')
  locationHistory(
    @Param('id') id: string,
    @Query() query: FindLocationHistoryQueryDto,
  ) {
    return super.findLocationHistory(id, query);
  }

  @Patch(':id/location')
  updateLocation(@Param('id') id: string, @Body() dto: UpdateUserLocationDto) {
    return super.updateLocation(id, dto);
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

  @Post('identity-check')
  checkIdentity(@Body() dto: CheckIdentityDto) {
    return this.users.checkIdentityTaken(dto);
  }

  @Get(':id')
  override findOne(@Param('id') id: string) {
    return super.findOne(id);
  }

  @Post()
  override create(@Body() dto: CreateUserDto) {
    return super.create(dto);
  }

  @Get(':id/location-history')
  locationHistory(
    @Param('id') id: string,
    @Query() query: FindLocationHistoryQueryDto,
  ) {
    return super.findLocationHistory(id, query);
  }

  @Patch(':id/location')
  updateLocation(@Param('id') id: string, @Body() dto: UpdateUserLocationDto) {
    return super.updateLocation(id, dto);
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
