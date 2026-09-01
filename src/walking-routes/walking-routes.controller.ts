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
import { isAdmin } from '../auth/roles.util';
import { CreateWalkingRouteDto } from './dto/create-walking-route.dto';
import { FindActiveWalkingRouteQueryDto } from './dto/find-active-walking-route-query.dto';
import { FindWalkingRoutesQueryDto } from './dto/find-walking-routes-query.dto';
import { UpdateWalkingRouteDto } from './dto/update-walking-route.dto';
import { WalkingRoutesService } from './walking-routes.service';

type RequestUser = {
  id: string;
  userRoles?: { role: { code: string } }[];
};

@Controller('walking-routes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WalkingRoutesController {
  constructor(private readonly walkingRoutes: WalkingRoutesService) {}

  @Get()
  @Roles('AUTHENTICATED')
  findAll(@Query() query: FindWalkingRoutesQueryDto) {
    return this.walkingRoutes.findAll(query);
  }

  @Get('active')
  @Roles('ADMIN', 'CARAVAN_MANAGER')
  findActive(
    @CurrentUser() user: RequestUser,
    @Query() query: FindActiveWalkingRouteQueryDto,
  ) {
    const targetId =
      query.userId && isAdmin(user) ? query.userId : user.id;
    return this.walkingRoutes.findActiveForManager(targetId);
  }

  @Get(':id')
  @Roles('AUTHENTICATED')
  findOne(@Param('id') id: string) {
    return this.walkingRoutes.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateWalkingRouteDto) {
    return this.walkingRoutes.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWalkingRouteDto) {
    return this.walkingRoutes.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.walkingRoutes.remove(id);
  }
}
