import { Transform } from 'class-transformer';
import { IsArray, IsString } from 'class-validator';
import { normalizeNationalId } from '../../common/national-id';

export class ImportReservationMembersDto {
  @Transform(({ value }) => {
    let items: unknown[] = [];
    if (Array.isArray(value)) items = value;
    else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) items = [];
      else if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed) as unknown;
          items = Array.isArray(parsed) ? parsed : [];
        } catch {
          items = trimmed.split(',');
        }
      } else {
        items = trimmed.split(',');
      }
    }
    return items
      .filter((item): item is string => typeof item === 'string')
      .map((item) => normalizeNationalId(item))
      .filter(Boolean);
  })
  @IsArray()
  @IsString({ each: true })
  nationalIds: string[];
}
