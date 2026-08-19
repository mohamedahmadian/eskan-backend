import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CitiesController } from './cities.controller';
import { CountriesController } from './countries.controller';
import { GeoService } from './geo.service';
import { ProvincesController } from './provinces.controller';

@Module({
  imports: [AuthModule],
  controllers: [CountriesController, ProvincesController, CitiesController],
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}
