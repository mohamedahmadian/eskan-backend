import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
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
import { AddReservationMemberDto } from './dto/add-reservation-member.dto';
import { UpdateReservationMemberDto } from './dto/update-reservation-member.dto';
import { AdjustReservationCapacityDto } from './dto/adjust-reservation-capacity.dto';
import { ApproveReservationDto } from './dto/approve-reservation.dto';
import { CopyPreviousMembersDto } from './dto/copy-previous-members.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { FindReservationsQueryDto } from './dto/find-reservations-query.dto';
import { ImportReservationMembersDto } from './dto/import-reservation-members.dto';
import { RejectReservationDto } from './dto/reject-reservation.dto';
import { RejectReservationPermitDto } from './dto/reject-reservation-permit.dto';
import { ReservationPermitOptionsQueryDto } from './dto/reservation-permit-options-query.dto';
import { ReturnReservationDto } from './dto/return-reservation.dto';
import { SetReservationContactDto } from './dto/set-reservation-contact.dto';
import { PayReservationInsuranceDto } from './dto/pay-reservation-insurance.dto';
import { UpdateMemberInsuranceDto } from './dto/update-member-insurance.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { UpdateReservationPermitDto } from './dto/update-reservation-permit.dto';
import { MEMBER_IMPORT_MAX_BYTES } from './reservation-member-excel';
import { ReservationsService } from './reservations.service';

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
  if (file.size > MEMBER_IMPORT_MAX_BYTES) {
    throw new BadRequestException('حجم فایل اکسل بیشتر از حد مجاز است');
  }
  return file;
}

const excelUploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: MEMBER_IMPORT_MAX_BYTES },
});

type RequestUser = {
  id: string;
  userRoles?: { role: { code: string } }[];
};

@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get('mine')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  findMine(
    @Query() query: FindReservationsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.findMine(query, actor);
  }

  @Get('mine/home')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  mineHome(@CurrentUser() actor: RequestUser) {
    return this.reservations.getMineHome(actor);
  }

  @Get('dashboard')
  dashboard(
    @Query('year', ParseIntPipe) year: number,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.getDashboard(year, actor);
  }

  @Get('permit-options')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  permitOptions(
    @Query() query: ReservationPermitOptionsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.listPermitOptions(query, actor);
  }

  @Get()
  findAll(
    @Query() query: FindReservationsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.findAll(query, actor);
  }

  /** TEMP: admin helper to wipe all pilgrimage cases; remove when no longer needed. */
  @Delete('purge-all')
  purgeAll(@CurrentUser() actor: RequestUser) {
    return this.reservations.purgeAll(actor);
  }

  @Get(':id/insurance')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  getInsurance(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.reservations.getInsurance(id, actor);
  }

  @Get(':id/members')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  listMembers(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.reservations.listMembers(id, actor);
  }

  @Get(':id/contacts')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  listContacts(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.reservations.listContacts(id, actor);
  }

  @Get(':id')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.reservations.findOne(id, actor);
  }

  @Post()
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  create(@Body() dto: CreateReservationDto, @CurrentUser() actor: RequestUser) {
    return this.reservations.create(dto, actor);
  }

  @Patch(':id')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.update(id, dto, actor);
  }

  @Post(':id/submit')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  submit(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.reservations.submit(id, actor);
  }

  @Post(':id/cancel')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  cancel(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.reservations.cancel(id, actor);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveReservationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.approve(id, actor, dto);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectReservationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.reject(id, dto.reason, actor);
  }

  @Patch(':id/capacity')
  adjustCapacity(
    @Param('id') id: string,
    @Body() dto: AdjustReservationCapacityDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.adjustCapacity(id, dto, actor);
  }

  @Post(':id/return')
  returnTo(
    @Param('id') id: string,
    @Body() dto: ReturnReservationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.returnTo(id, dto.status, actor);
  }

  @Patch(':id/permit')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  updatePermit(
    @Param('id') id: string,
    @Body() dto: UpdateReservationPermitDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.updatePermit(id, dto, actor);
  }

  @Post(':id/permit/approve')
  approvePermit(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.reservations.approvePermit(id, actor);
  }

  @Post(':id/permit/reject')
  rejectPermit(
    @Param('id') id: string,
    @Body() dto: RejectReservationPermitDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.rejectPermit(id, dto, actor);
  }

  @Get(':id/members/import-template')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    'attachment; filename="companions-template.xlsx"; filename*=UTF-8\'\'%D9%86%D9%85%D9%88%D9%86%D9%87-%D9%87%D9%85%D8%B1%D8%A7%D9%87%D8%A7%D9%86.xlsx',
  )
  async memberImportTemplate(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const buffer = await this.reservations.memberImportTemplate(id, actor);
    return new StreamableFile(buffer);
  }

  @Get(':id/members/previous')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  previousMembers(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.reservations.getPreviousMembers(id, actor);
  }

  @Get(':id/previous-approved-counts')
  previousApprovedCounts(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.getPreviousApprovedCounts(id, actor);
  }

  @Post(':id/members/import/preview')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  @UseInterceptors(excelUploadInterceptor)
  previewMemberImport(
    @Param('id') id: string,
    @UploadedFile() file: ExcelUpload,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.previewMemberImport(
      id,
      assertExcelUpload(file).buffer,
      actor,
    );
  }

  @Post(':id/members/import/errors')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  @UseInterceptors(excelUploadInterceptor)
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    'attachment; filename="companion-import-errors.xlsx"; filename*=UTF-8\'\'%D8%AE%D8%B7%D8%A7%D9%87%D8%A7%DB%8C-%D9%87%D9%85%D8%B1%D8%A7%D9%87%D8%A7%D9%86.xlsx',
  )
  async memberImportErrors(
    @Param('id') id: string,
    @UploadedFile() file: ExcelUpload,
    @CurrentUser() actor: RequestUser,
  ) {
    const buffer = await this.reservations.exportMemberImportErrors(
      id,
      assertExcelUpload(file).buffer,
      actor,
    );
    return new StreamableFile(buffer);
  }

  @Post(':id/members/import')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  @UseInterceptors(excelUploadInterceptor)
  importMembers(
    @Param('id') id: string,
    @UploadedFile() file: ExcelUpload,
    @Body() dto: ImportReservationMembersDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.importMembers(
      id,
      assertExcelUpload(file).buffer,
      dto.nationalIds ?? [],
      actor,
    );
  }

  @Post(':id/members')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  addMember(
    @Param('id') id: string,
    @Body() dto: AddReservationMemberDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.addMember(id, dto, actor);
  }

  @Patch(':id/members/:memberId')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  updateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateReservationMemberDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.updateMember(id, memberId, dto, actor);
  }

  @Delete(':id/members/:memberId')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.removeMember(id, memberId, actor);
  }

  @Post(':id/members/copy-previous')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  copyPrevious(
    @Param('id') id: string,
    @Body() dto: CopyPreviousMembersDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.copyPreviousMembers(
      id,
      actor,
      dto.sourceReservationId,
    );
  }

  @Post(':id/companions/complete')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  completeCompanions(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.completeCompanions(id, actor);
  }

  @Put(':id/contacts')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  setContact(
    @Param('id') id: string,
    @Body() dto: SetReservationContactDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.setContact(id, dto, actor);
  }

  @Post(':id/contacts/from-caravan')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  copyContactsFromCaravan(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.copyContactsFromCaravan(id, actor);
  }

  @Delete(':id/contacts')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  removeAllContacts(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.removeAllContacts(id, actor);
  }

  @Delete(':id/contacts/:role')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  removeContact(
    @Param('id') id: string,
    @Param('role') role: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.removeContact(id, role, actor);
  }

  @Post(':id/contacts/complete')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  completeContacts(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.reservations.completeContacts(id, actor);
  }

  @Post(':id/insurance/pay')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  payInsurance(
    @Param('id') id: string,
    @Body() dto: PayReservationInsuranceDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.payInsurance(
      id,
      dto.memberIds,
      dto.insurancePlanId,
      actor,
    );
  }

  @Patch(':id/members/:memberId/insurance')
  updateInsurance(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberInsuranceDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.updateMemberInsurance(id, memberId, dto, actor);
  }

  @Post(':id/complete')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  complete(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.reservations.complete(id, actor);
  }

  @Post(':id/insurance/complete')
  @Roles('ADMIN', 'PILGRIM', 'CARAVAN_MANAGER')
  completeInsurance(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reservations.completeInsurance(id, actor);
  }
}
