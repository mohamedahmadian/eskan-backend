import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CaravansModule } from './caravans/caravans.module';
import { GroupsModule } from './groups/groups.module';
import { EntryBordersModule } from './entry-borders/entry-borders.module';
import { GeoModule } from './geo/geo.module';
import { ImagesModule } from './images/images.module';
import { PrismaModule } from './prisma/prisma.module';
import { SmsModule } from './sms/sms.module';
import { AccommodationsModule } from './accommodations/accommodations.module';
import { UsersModule } from './users/users.module';
import { FoodSuppliersModule } from './food-suppliers/food-suppliers.module';
import { BenefactorsModule } from './benefactors/benefactors.module';
import { GovernmentOrganizationsModule } from './government-organizations/government-organizations.module';
import { PlaceTypesModule } from './place-types/place-types.module';
import { PlacesModule } from './places/places.module';
import { OrgUnitsModule } from './org-units/org-units.module';
import { HeadquartersInfoModule } from './headquarters-info/headquarters-info.module';
import { HeadquartersPhonesModule } from './headquarters-phones/headquarters-phones.module';
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
import { ReceptionModule } from './reception/reception.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { HonoraryServantsModule } from './honorary-servants/honorary-servants.module';
import { ProvincialMonitoringModule } from './provincial-monitoring/provincial-monitoring.module';
import { NationalMonitoringModule } from './national-monitoring/national-monitoring.module';
import { SupportRequestsModule } from './support-requests/support-requests.module';
import { PlacementsModule } from './placements/placements.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    ImagesModule,
    GeoModule,
    EntryBordersModule,
    CaravansModule,
    GroupsModule,
    SmsModule,
    AccommodationsModule,
    UsersModule,
    WalkingRoutesModule,
    FoodSuppliersModule,
    BenefactorsModule,
    GovernmentOrganizationsModule,
    PlaceTypesModule,
    PlacesModule,
    OrgUnitsModule,
    HeadquartersInfoModule,
    HeadquartersPhonesModule,
    IssuedLicensesModule,
    SuppliersModule,
    SupplierItemsModule,
    AccommodationLoansModule,
    ItemQuotasModule,
    ItemQuotaVouchersModule,
    IceVouchersModule,
    PublicVouchersModule,
    ReservationsModule,
    ReceptionModule,
    EvaluationsModule,
    HonoraryServantsModule,
    ProvincialMonitoringModule,
    NationalMonitoringModule,
    SupportRequestsModule,
    PlacementsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
