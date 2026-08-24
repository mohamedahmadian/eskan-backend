import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GovernmentOrganizationsController } from './government-organizations.controller';
import { GovernmentOrganizationsService } from './government-organizations.service';

@Module({
  imports: [AuthModule],
  controllers: [GovernmentOrganizationsController],
  providers: [GovernmentOrganizationsService],
})
export class GovernmentOrganizationsModule {}
