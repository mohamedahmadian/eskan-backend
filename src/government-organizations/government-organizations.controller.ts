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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateGovernmentOrganizationDto } from './dto/create-government-organization.dto';
import { FindGovernmentOrganizationsQueryDto } from './dto/find-government-organizations-query.dto';
import { UpdateGovernmentOrganizationDto } from './dto/update-government-organization.dto';
import { GovernmentOrganizationsService } from './government-organizations.service';

@Controller('government-organizations')
@UseGuards(JwtAuthGuard)
export class GovernmentOrganizationsController {
  constructor(
    private readonly governmentOrganizations: GovernmentOrganizationsService,
  ) {}

  @Get()
  findAll(@Query() query: FindGovernmentOrganizationsQueryDto) {
    return this.governmentOrganizations.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.governmentOrganizations.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateGovernmentOrganizationDto) {
    return this.governmentOrganizations.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGovernmentOrganizationDto,
  ) {
    return this.governmentOrganizations.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.governmentOrganizations.remove(id);
  }
}
