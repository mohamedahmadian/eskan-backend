import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CaravansService } from './caravans/caravans.service';
import { UsersService } from './users/users.service';

@Controller()
export class AppController {
  constructor(
    private readonly users: UsersService,
    private readonly caravans: CaravansService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async stats() {
    const [pilgrims, caravans] = await Promise.all([
      this.users.countByRole('PILGRIM'),
      this.caravans.count(),
    ]);
    return { pilgrims, caravans };
  }
}
