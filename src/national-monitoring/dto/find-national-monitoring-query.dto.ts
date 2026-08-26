import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const nationalMonitoringExportSections = [
  'province',
  'city',
  'route',
] as const;

export type NationalMonitoringExportSection =
  (typeof nationalMonitoringExportSections)[number];

export class FindNationalMonitoringQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(1600)
  year?: number;
}

export class FindNationalMonitoringExportQueryDto extends FindNationalMonitoringQueryDto {
  @IsIn(nationalMonitoringExportSections)
  section!: NationalMonitoringExportSection;
}
