import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HeadquartersInfoController } from './headquarters-info.controller';
import { HeadquartersInfoService } from './headquarters-info.service';

@Module({
  imports: [AuthModule],
  controllers: [HeadquartersInfoController],
  providers: [HeadquartersInfoService],
  exports: [HeadquartersInfoService],
})
export class HeadquartersInfoModule {}
