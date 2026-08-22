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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateCaravanDto } from './dto/create-caravan.dto';
import { FindCaravansQueryDto } from './dto/find-caravans-query.dto';
import { UpdateCaravanDto } from './dto/update-caravan.dto';
import { CaravansService } from './caravans.service';

type RequestUser = {
  id: string;
  userRoles?: { role: { code: string } }[];
};

@Controller('caravans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CaravansController {
  constructor(private readonly caravans: CaravansService) {}

  @Get()
  findAll(@Query() query: FindCaravansQueryDto) {
    return this.caravans.findAll(query);
  }

  @Get('mine')
  @Roles('ADMIN', 'CARAVAN_MANAGER', 'PILGRIM')
  findMine(
    @Query() query: FindCaravansQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.findMine(query, actor.id);
  }

  @Get(':id')
  @Roles('ADMIN', 'CARAVAN_MANAGER', 'PILGRIM')
  findOne(@Param('id') id: string) {
    return this.caravans.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'CARAVAN_MANAGER', 'PILGRIM')
  create(@Body() dto: CreateCaravanDto, @CurrentUser() actor: RequestUser) {
    return this.caravans.create(dto, actor);
  }

  @Patch(':id')
  @Roles('ADMIN', 'CARAVAN_MANAGER', 'PILGRIM')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCaravanDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.caravans.update(id, dto, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.caravans.remove(id);
  }
}
