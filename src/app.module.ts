import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CaravansModule } from './caravans/caravans.module';
import { GroupsModule } from './groups/groups.module';
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
import { GovernmentOrganizationsModule } from './government-organizations/government-organizations.module';
import { OrgUnitsModule } from './org-units/org-units.module';
import { IssuedLicensesModule } from './issued-licenses/issued-licenses.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { SupplierItemsModule } from './supplier-items/supplier-items.module';
import { AccommodationLoansModule } from './accommodation-loans/accommodation-loans.module';
import { ItemQuotasModule } from './item-quotas/item-quotas.module';
import { ItemQuotaVouchersModule } from './item-quota-vouchers/item-quota-vouchers.module';
import { IceVouchersModule } from './ice-vouchers/ice-vouchers.module';
import { WalkingRoutesModule } from './walking-routes/walking-routes.module';
import { PublicVouchersModule } from './public-vouchers/public-vouchers.module';
import { ReservationsModule } from './reservations/reservations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ImagesModule,
    GeoModule,
    CaravansModule,
    GroupsModule,
    SmsModule,
    AccommodationsModule,
    UsersModule,
    WalkingRoutesModule,
    FoodSuppliersModule,
    MedicalCentersModule,
    RedCrescentsModule,
    BenefactorsModule,
    GovernmentOrganizationsModule,
    OrgUnitsModule,
    IssuedLicensesModule,
    SuppliersModule,
    SupplierItemsModule,
    AccommodationLoansModule,
    ItemQuotasModule,
    ItemQuotaVouchersModule,
    IceVouchersModule,
    PublicVouchersModule,
    ReservationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
