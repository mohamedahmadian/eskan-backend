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
import { CreateHonoraryServiceTypeDto } from './dto/create-honorary-service-type.dto';
import { FindHonoraryServiceTypesQueryDto } from './dto/find-honorary-service-types-query.dto';
import { UpdateHonoraryServiceTypeDto } from './dto/update-honorary-service-type.dto';
import { HonoraryServantsService } from './honorary-servants.service';

@Controller('honorary-service-types')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class HonoraryServiceTypesController {
  constructor(private readonly honoraryServants: HonoraryServantsService) {}

  @Get()
  @Roles('AUTHENTICATED')
  findAll(@Query() query: FindHonoraryServiceTypesQueryDto) {
    return this.honoraryServants.findTypes(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.honoraryServants.findType(id);
  }

  @Post()
  create(@Body() dto: CreateHonoraryServiceTypeDto) {
    return this.honoraryServants.createType(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHonoraryServiceTypeDto) {
    return this.honoraryServants.updateType(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.honoraryServants.removeType(id);
  }
}
