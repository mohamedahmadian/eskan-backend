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
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { FindSupportRequestReportQueryDto } from './dto/find-support-request-report-query.dto';
import { FindSupportRequestsQueryDto } from './dto/find-support-requests-query.dto';
import { UpdateSupportRequestDto } from './dto/update-support-request.dto';
import { SupportRequestsService } from './support-requests.service';

type RequestUser = {
  id: string;
  issuingOrganizationId: string | null;
  userRoles: { role: { code: string } }[];
};

@Controller('support-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'GOVERNMENT_ORG_OFFICER')
export class SupportRequestsController {
  constructor(private readonly supportRequests: SupportRequestsService) {}

  @Get()
  findAll(
    @Query() query: FindSupportRequestsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.supportRequests.findAll(query, actor);
  }

  @Get('export')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    "attachment; filename=\"support-requests.xlsx\"; filename*=UTF-8''%D8%AF%D8%B1%D8%AE%D9%88%D8%A7%D8%B3%D8%AA%E2%80%8C%D9%87%D8%A7%DB%8C-%D9%BE%D8%B4%D8%AA%DB%8C%D8%A8%D8%A7%D9%86%DB%8C.xlsx",
  )
  async export(
    @Query() query: FindSupportRequestsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const buffer = await this.supportRequests.exportExcel(query, actor);
    return new StreamableFile(buffer);
  }

  @Get('report')
  report(
    @Query() query: FindSupportRequestReportQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.supportRequests.report(query, actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.supportRequests.findOne(id, actor);
  }

  @Post()
  create(
    @Body() dto: CreateSupportRequestDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.supportRequests.create(dto, actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupportRequestDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.supportRequests.update(id, dto, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.supportRequests.remove(id, actor);
  }
}
