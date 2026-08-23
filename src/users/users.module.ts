import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SmsModule } from '../sms/sms.module';
import {
  AccommodationManagersController,
  CaravanManagersController,
  HeadquartersRepresentativesController,
  PilgrimsUsersController,
} from './role-scoped-users.controller';
import { RolesController } from './roles.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, SmsModule],
  controllers: [
    UsersController,
    RolesController,
    PilgrimsUsersController,
    CaravanManagersController,
    AccommodationManagersController,
    HeadquartersRepresentativesController,
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
