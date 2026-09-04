import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DataManagementService } from './data-management.service';

type RequestUser = { id: string };

@Controller('data-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class DataManagementController {
  constructor(private readonly dataManagement: DataManagementService) {}

  @Get()
  list() {
    return this.dataManagement.list();
  }

  @Delete(':code')
  wipe(@Param('code') code: string, @CurrentUser() actor: RequestUser) {
    return this.dataManagement.wipe(code, actor);
  }
}
