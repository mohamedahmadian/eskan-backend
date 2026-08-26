import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupportRequestsController } from './support-requests.controller';
import { SupportRequestsService } from './support-requests.service';

@Module({
  imports: [AuthModule],
  controllers: [SupportRequestsController],
  providers: [SupportRequestsService],
})
export class SupportRequestsModule {}
