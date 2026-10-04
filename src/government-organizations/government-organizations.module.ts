import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { GovernmentOrganizationsController } from './government-organizations.controller';
import { GovernmentOrganizationsService } from './government-organizations.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [GovernmentOrganizationsController],
  providers: [GovernmentOrganizationsService],
})
export class GovernmentOrganizationsModule {}
