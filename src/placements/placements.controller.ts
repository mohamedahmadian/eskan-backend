import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AllocatePlacementDto } from './dto/allocate-placement.dto';
import { FindPlacementDueQueryDto } from './dto/find-placement-due-query.dto';
import { StartPlacementSolverDto, PlacementSolverQueryDto } from './dto/placement-solver.dto';
import { FindPlacementQueueQueryDto } from './dto/find-placement-queue-query.dto';
import { PlacementAvailabilityQueryDto } from './dto/placement-availability-query.dto';
import { UpdateAllocationDto } from './dto/update-allocation.dto';
import { PlacementSolverService } from './placement-solver.service';
import { PlacementsService } from './placements.service';

type RequestUser = {
  id: string;
  userRoles: { role: { code: string } }[];
};

@Controller('placements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PlacementsController {
  constructor(
    private readonly placements: PlacementsService,
    private readonly solver: PlacementSolverService,
  ) {}

  @Get('queue')
  queue(
    @Query() query: FindPlacementQueueQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.placements.findQueue(query, actor);
  }

  @Get('queue/export')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    "attachment; filename=\"placements.xlsx\"; filename*=UTF-8''%D8%AC%D8%A7%D9%86%D9%85%D8%A7%DB%8C%DB%8C.xlsx",
  )
  async exportQueue(
    @Query() query: FindPlacementQueueQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const buffer = await this.placements.exportQueue(query, actor);
    return new StreamableFile(buffer);
  }

  @Get('due')
  due(
    @Query() query: FindPlacementDueQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.placements.findDue(query, actor);
  }

  @Get('accommodations/availability')
  availability(
    @Query() query: PlacementAvailabilityQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.placements.availability(query, actor);
  }

  @Get('reservations/:id')
  getReservation(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.placements.getReservation(id, actor);
  }

  @Post('allocate')
  allocate(
    @Body() dto: AllocatePlacementDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.placements.allocateManual(dto, actor);
  }

  @Get('system/board')
  systemBoard(
    @Query() query: PlacementSolverQueryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.solver.board(query.year, actor);
  }

  @Post('system/start')
  startSystem(
    @Body() dto: StartPlacementSolverDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.solver.start(dto, actor);
  }

  @Get('system/status')
  systemStatus(@CurrentUser() actor: RequestUser) {
    return this.solver.status(actor);
  }

  @Post('system/stop')
  stopSystem(@CurrentUser() actor: RequestUser) {
    return this.solver.stop(actor);
  }

  @Post('system/save')
  saveSystem(@CurrentUser() actor: RequestUser) {
    return this.solver.save(actor);
  }

  @Patch('allocations/:id')
  updateAllocation(
    @Param('id') id: string,
    @Body() dto: UpdateAllocationDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.placements.updateAllocation(id, dto, actor);
  }

  @Post('allocations/:id/vacate')
  vacateAllocation(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.placements.vacateAllocation(id, actor);
  }

  @Post('vacate-due')
  vacateDue(@CurrentUser() actor: RequestUser) {
    return this.placements.vacateDue(actor);
  }
}
