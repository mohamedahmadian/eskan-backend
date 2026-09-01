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
import { CreateHonoraryServantDto } from './dto/create-honorary-servant.dto';
import { CreateMyHonoraryServantDto } from './dto/create-my-honorary-servant.dto';
import { FindHonoraryCandidatesQueryDto } from './dto/find-honorary-candidates-query.dto';
import { FindHonoraryServantsQueryDto } from './dto/find-honorary-servants-query.dto';
import { UpdateHonoraryServantDto } from './dto/update-honorary-servant.dto';
import { HonoraryServantsService } from './honorary-servants.service';

type RequestUser = {
  id: string;
  userRoles: { role: { code: string } }[];
};

@Controller('honorary-servants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class HonoraryServantsController {
  constructor(private readonly honoraryServants: HonoraryServantsService) {}

  @Get()
  findAll(@Query() query: FindHonoraryServantsQueryDto) {
    return this.honoraryServants.findAll(query);
  }

  @Get('stats')
  stats() {
    return this.honoraryServants.stats();
  }

  @Get('candidates')
  findCandidates(@Query() query: FindHonoraryCandidatesQueryDto) {
    return this.honoraryServants.findCandidates(query.serviceTypeId);
  }

  @Get('mine')
  @Roles('AUTHENTICATED')
  findMine(
    @Query() query: FindHonoraryServantsQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.honoraryServants.findMine(actor.id, query);
  }

  @Post('mine')
  @Roles('AUTHENTICATED')
  createMine(
    @Body() dto: CreateMyHonoraryServantDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.honoraryServants.create({ ...dto, userId: actor.id });
  }

  @Get(':id')
  @Roles('AUTHENTICATED')
  findOne(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.honoraryServants.findOneFor(id, actor);
  }

  @Post()
  create(@Body() dto: CreateHonoraryServantDto) {
    return this.honoraryServants.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHonoraryServantDto) {
    return this.honoraryServants.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.honoraryServants.remove(id);
  }
}
