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
import { CreateBenefactorDto } from './dto/create-benefactor.dto';
import { FindBenefactorsQueryDto } from './dto/find-benefactors-query.dto';
import { UpdateBenefactorDto } from './dto/update-benefactor.dto';
import { BenefactorsService } from './benefactors.service';

@Controller('benefactors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class BenefactorsController {
  constructor(private readonly benefactors: BenefactorsService) {}

  @Get()
  findAll(@Query() query: FindBenefactorsQueryDto) {
    return this.benefactors.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.benefactors.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBenefactorDto) {
    return this.benefactors.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBenefactorDto) {
    return this.benefactors.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.benefactors.remove(id);
  }
}
