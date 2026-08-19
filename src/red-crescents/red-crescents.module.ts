import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RedCrescentsController } from './red-crescents.controller';
import { RedCrescentsService } from './red-crescents.service';

@Module({
  imports: [AuthModule],
  controllers: [RedCrescentsController],
  providers: [RedCrescentsService],
})
export class RedCrescentsModule {}
