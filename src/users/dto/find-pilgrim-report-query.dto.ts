import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class FindPilgrimReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year?: number;
}

export const pilgrimReportExportSections = [
  'country',
  'province',
  'city',
  'year',
] as const;

export type PilgrimReportExportSection =
  (typeof pilgrimReportExportSections)[number];

export class FindPilgrimReportExportQueryDto extends FindPilgrimReportQueryDto {
  @IsIn(pilgrimReportExportSections)
  section!: PilgrimReportExportSection;
}

export class FindPilgrimReportProvinceTimelineQueryDto {
  @IsString()
  @IsNotEmpty()
  provinceId!: string;
}

export class FindPilgrimReportCityTimelineQueryDto {
  @IsString()
  @IsNotEmpty()
  cityId!: string;
}
