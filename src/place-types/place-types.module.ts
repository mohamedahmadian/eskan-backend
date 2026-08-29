import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlaceTypesController } from './place-types.controller';
import { PlaceTypesService } from './place-types.service';

@Module({
  imports: [AuthModule],
  controllers: [PlaceTypesController],
  providers: [PlaceTypesService],
})
export class PlaceTypesModule {}
