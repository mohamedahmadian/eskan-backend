import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HeadquartersPhonesController } from './headquarters-phones.controller';
import { HeadquartersPhonesService } from './headquarters-phones.service';

@Module({
  imports: [AuthModule],
  controllers: [HeadquartersPhonesController],
  providers: [HeadquartersPhonesService],
})
export class HeadquartersPhonesModule {}
