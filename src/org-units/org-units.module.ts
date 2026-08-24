import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SmsModule } from '../sms/sms.module';
import { UsersModule } from '../users/users.module';
import { OrgUnitsController } from './org-units.controller';
import { OrgUnitsService } from './org-units.service';

@Module({
  imports: [AuthModule, UsersModule, SmsModule],
  controllers: [OrgUnitsController],
  providers: [OrgUnitsService],
})
export class OrgUnitsModule {}
