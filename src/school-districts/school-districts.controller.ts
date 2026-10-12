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
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateSchoolDistrictDto } from './dto/create-school-district.dto';
import { FindSchoolDistrictsQueryDto } from './dto/find-school-districts-query.dto';
import { UpdateSchoolDistrictDto } from './dto/update-school-district.dto';
import { SchoolDistrictsService } from './school-districts.service';

@Controller('school-districts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchoolDistrictsController {
  constructor(private readonly schoolDistricts: SchoolDistrictsService) {}

  @Get()
  @Public()
  findAll(@Query() query: FindSchoolDistrictsQueryDto) {
    return this.schoolDistricts.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.schoolDistricts.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateSchoolDistrictDto) {
    return this.schoolDistricts.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateSchoolDistrictDto) {
    return this.schoolDistricts.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.schoolDistricts.remove(id);
  }
}
