import { IsUUID } from 'class-validator';

export class AssignHeadquartersProvinceDto {
  @IsUUID()
  provinceId: string;
}

export class AssignHeadquartersCityDto {
  @IsUUID()
  cityId: string;
}
