import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { isAdmin } from '../auth/roles.util';
import { CreateOrgUnitDto } from './dto/create-org-unit.dto';
import { FindOrgUnitsQueryDto } from './dto/find-org-units-query.dto';
import { FindUnitLiaisonsQueryDto } from './dto/find-unit-liaisons-query.dto';
import { InviteOrgUnitLiaisonsSmsDto } from './dto/invite-org-unit-liaisons-sms.dto';
import { SetOrgUnitLiaisonsDto } from './dto/set-org-unit-liaisons.dto';
import { UpdateOrgUnitDto } from './dto/update-org-unit.dto';
import { OrgUnitsService } from './org-units.service';

type RequestUser = {
  id: string;
  userRoles?: { role: { code: string } }[];
  roles?: { code: string }[];
};

@Controller('org-units')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrgUnitsController {
  constructor(private readonly orgUnits: OrgUnitsService) {}

  @Get('my-accommodation-liaisons')
  @Roles('ADMIN', 'UNIT_MANAGER')
  findMyAccommodationLiaisons(
    @Query() query: FindUnitLiaisonsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.orgUnits.findMyAccommodationLiaisons(
      actor.id,
      isAdmin(actor),
      query,
    );
  }

  @Get('my-caravan-liaisons')
  @Roles('ADMIN', 'UNIT_MANAGER')
  findMyCaravanLiaisons(
    @Query() query: FindUnitLiaisonsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.orgUnits.findMyCaravanLiaisons(
      actor.id,
      isAdmin(actor),
      query,
    );
  }

  @Post('my-liaisons/invite-channels')
  @Roles('ADMIN', 'UNIT_MANAGER')
  inviteMyLiaisonsChannels(
    @Body() dto: InviteOrgUnitLiaisonsSmsDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.orgUnits.inviteMyLiaisonsSms(dto, actor, isAdmin(actor));
  }

  @Get('public')
  @Public()
  @Roles()
  findPublic() {
    return this.orgUnits.findPublic();
  }

  @Get()
  @Roles('ADMIN')
  findAll(@Query() query: FindOrgUnitsQueryDto) {
    return this.orgUnits.findAll(query);
  }

  @Get(':id/liaisons')
  @Roles('ADMIN')
  getLiaisons(@Param('id') id: string) {
    return this.orgUnits.getLiaisons(id);
  }

  @Put(':id/liaisons')
  @Roles('ADMIN')
  setLiaisons(@Param('id') id: string, @Body() dto: SetOrgUnitLiaisonsDto) {
    return this.orgUnits.setLiaisons(id, dto);
  }

  @Post(':id/invite-liaisons-sms')
  @Roles('ADMIN', 'UNIT_MANAGER')
  inviteLiaisonsSms(
    @Param('id') id: string,
    @Body() dto: InviteOrgUnitLiaisonsSmsDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.orgUnits.inviteLiaisonsSms(id, dto, actor, isAdmin(actor));
  }

  @Get(':id')
  @Roles('ADMIN')
  findOne(@Param('id') id: string) {
    return this.orgUnits.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateOrgUnitDto) {
    return this.orgUnits.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateOrgUnitDto) {
    return this.orgUnits.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.orgUnits.remove(id);
  }
}
