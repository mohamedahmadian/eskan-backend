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
import { CreateHeadquartersPhoneDto } from './dto/create-headquarters-phone.dto';
import { FindHeadquartersPhonesQueryDto } from './dto/find-headquarters-phones-query.dto';
import { UpdateHeadquartersPhoneDto } from './dto/update-headquarters-phone.dto';
import { HeadquartersPhonesService } from './headquarters-phones.service';

@Controller('headquarters-phones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class HeadquartersPhonesController {
  constructor(private readonly headquartersPhones: HeadquartersPhonesService) {}

  @Get()
  findAll(@Query() query: FindHeadquartersPhonesQueryDto) {
    return this.headquartersPhones.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.headquartersPhones.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateHeadquartersPhoneDto) {
    return this.headquartersPhones.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHeadquartersPhoneDto) {
    return this.headquartersPhones.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.headquartersPhones.remove(id);
  }
}
