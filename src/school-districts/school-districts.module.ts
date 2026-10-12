import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SchoolDistrictsController } from './school-districts.controller';
import { SchoolDistrictsService } from './school-districts.service';

@Module({
  imports: [AuthModule],
  controllers: [SchoolDistrictsController],
  providers: [SchoolDistrictsService],
})
export class SchoolDistrictsModule {}
