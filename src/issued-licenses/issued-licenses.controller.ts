import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateIssuedLicenseDto } from './dto/create-issued-license.dto';
import {
  FindIssuedLicensesQueryDto,
  LookupCaravanManagerQueryDto,
} from './dto/find-issued-licenses-query.dto';
import { IssuedLicensesService } from './issued-licenses.service';

type RequestUser = {
  id: string;
};

@Controller('issued-licenses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'LICENSE_ISSUER')
export class IssuedLicensesController {
  constructor(private readonly issuedLicenses: IssuedLicensesService) {}

  @Get('lookup')
  lookup(@Query() query: LookupCaravanManagerQueryDto) {
    return this.issuedLicenses.lookupManager(query);
  }

  @Get()
  findAll(@Query() query: FindIssuedLicensesQueryDto) {
    return this.issuedLicenses.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.issuedLicenses.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateIssuedLicenseDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.issuedLicenses.create(dto, actor.id);
  }

  @Post(':id/approve')
  @Roles('ADMIN')
  approve(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.issuedLicenses.approve(id, actor.id);
  }

  @Post(':id/revoke')
  revoke(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.issuedLicenses.revoke(id, actor.id);
  }
}
