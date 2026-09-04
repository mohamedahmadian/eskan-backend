import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DataManagementController } from './data-management.controller';
import { DataManagementService } from './data-management.service';

@Module({
  imports: [AuthModule],
  controllers: [DataManagementController],
  providers: [DataManagementService],
})
export class DataManagementModule {}
