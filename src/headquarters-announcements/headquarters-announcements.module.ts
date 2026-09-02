import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HeadquartersAnnouncementsController } from './headquarters-announcements.controller';
import { HeadquartersAnnouncementsService } from './headquarters-announcements.service';

@Module({
  imports: [AuthModule],
  controllers: [HeadquartersAnnouncementsController],
  providers: [HeadquartersAnnouncementsService],
})
export class HeadquartersAnnouncementsModule {}
