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
import { CreateMedicalCenterDto } from './dto/create-medical-center.dto';
import { FindMedicalCentersQueryDto } from './dto/find-medical-centers-query.dto';
import { UpdateMedicalCenterDto } from './dto/update-medical-center.dto';
import { MedicalCentersService } from './medical-centers.service';

@Controller('medical-centers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MedicalCentersController {
  constructor(private readonly medicalCenters: MedicalCentersService) {}

  @Get()
  findAll(@Query() query: FindMedicalCentersQueryDto) {
    return this.medicalCenters.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.medicalCenters.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateMedicalCenterDto) {
    return this.medicalCenters.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMedicalCenterDto) {
    return this.medicalCenters.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.medicalCenters.remove(id);
  }
}
