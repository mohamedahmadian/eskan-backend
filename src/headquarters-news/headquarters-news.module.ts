import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HeadquartersNewsController } from './headquarters-news.controller';
import { HeadquartersNewsService } from './headquarters-news.service';

@Module({
  imports: [AuthModule],
  controllers: [HeadquartersNewsController],
  providers: [HeadquartersNewsService],
})
export class HeadquartersNewsModule {}
