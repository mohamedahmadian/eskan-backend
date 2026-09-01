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
import { CreateGroupDto } from './dto/create-group.dto';
import { FindGroupsQueryDto } from './dto/find-groups-query.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupsService } from './groups.service';

type RequestUser = {
  id: string;
  userRoles?: { role: { code: string } }[];
};

const mineRoles = ['ADMIN', 'GROUP_MANAGER', 'CARAVAN_MANAGER', 'PILGRIM'] as const;

@Controller('groups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  findAll(@Query() query: FindGroupsQueryDto) {
    return this.groups.findAll(query);
  }

  @Get('mine')
  @Roles('AUTHENTICATED')
  findMine(
    @Query() query: FindGroupsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.groups.findMine(query, actor.id);
  }

  @Get(':id')
  @Roles(...mineRoles)
  findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.groups.findOne(id, actor);
  }

  @Post()
  @Roles('AUTHENTICATED')
  create(@Body() dto: CreateGroupDto, @CurrentUser() actor: RequestUser) {
    return this.groups.create(dto, actor);
  }

  @Patch(':id')
  @Roles(...mineRoles)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.groups.update(id, dto, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.groups.remove(id);
  }
}
