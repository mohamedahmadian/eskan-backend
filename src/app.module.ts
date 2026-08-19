import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CaravansModule } from './caravans/caravans.module';
import { GeoModule } from './geo/geo.module';
import { ImagesModule } from './images/images.module';
import { PrismaModule } from './prisma/prisma.module';
import { SmsModule } from './sms/sms.module';
import { AccommodationsModule } from './accommodations/accommodations.module';
import { UsersModule } from './users/users.module';
import { FoodSuppliersModule } from './food-suppliers/food-suppliers.module';
import { MedicalCentersModule } from './medical-centers/medical-centers.module';
import { RedCrescentsModule } from './red-crescents/red-crescents.module';
import { BenefactorsModule } from './benefactors/benefactors.module';
import { WalkingRoutesModule } from './walking-routes/walking-routes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ImagesModule,
    GeoModule,
    CaravansModule,
    SmsModule,
    AccommodationsModule,
    UsersModule,
    WalkingRoutesModule,
    FoodSuppliersModule,
    MedicalCentersModule,
    RedCrescentsModule,
    BenefactorsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
