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
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { FindAccommodationsQueryDto } from './dto/find-accommodations-query.dto';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto';
import { AccommodationsService } from './accommodations.service';

type RequestUser = {
  id: string;
  userRoles: { role: { code: string } }[];
};

@Controller('accommodations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'ACCOMMODATION_MANAGER')
export class AccommodationsController {
  constructor(private readonly accommodations: AccommodationsService) {}

  @Get()
  findAll(
    @Query() query: FindAccommodationsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.findAll(query, actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.accommodations.findOne(id, actor);
  }

  @Post()
  create(
    @Body() dto: CreateAccommodationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.create(dto, actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAccommodationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.accommodations.update(id, dto, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.accommodations.remove(id, actor);
  }
}
