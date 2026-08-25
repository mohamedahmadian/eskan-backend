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
import { CreateHeadquartersInfoDto } from './dto/create-headquarters-info.dto';
import { FindHeadquartersInfoQueryDto } from './dto/find-headquarters-info-query.dto';
import { UpdateHeadquartersInfoDto } from './dto/update-headquarters-info.dto';
import { HeadquartersInfoService } from './headquarters-info.service';

@Controller('headquarters-info')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class HeadquartersInfoController {
  constructor(private readonly headquartersInfo: HeadquartersInfoService) {}

  @Get()
  findAll(@Query() query: FindHeadquartersInfoQueryDto) {
    return this.headquartersInfo.findAll(query);
  }

  @Get('summary')
  @Public()
  @Roles()
  summary() {
    return this.headquartersInfo.summary();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.headquartersInfo.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateHeadquartersInfoDto) {
    return this.headquartersInfo.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHeadquartersInfoDto) {
    return this.headquartersInfo.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.headquartersInfo.remove(id);
  }
}
