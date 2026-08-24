import { IsArray, IsEnum } from 'class-validator';
import {
  AccommodationContactRole,
  CaravanContactRole,
} from '../../generated/prisma/client';

export class SetOrgUnitLiaisonsDto {
  @IsArray()
  @IsEnum(AccommodationContactRole, { each: true })
  accommodationRoles: AccommodationContactRole[];

  @IsArray()
  @IsEnum(CaravanContactRole, { each: true })
  caravanRoles: CaravanContactRole[];
}
