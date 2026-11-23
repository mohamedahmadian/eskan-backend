import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccommodationTypesController } from './accommodation-types.controller';
import { AccommodationTypesService } from './accommodation-types.service';

@Module({
  imports: [AuthModule],
  controllers: [AccommodationTypesController],
  providers: [AccommodationTypesService],
})
export class AccommodationTypesModule {}
