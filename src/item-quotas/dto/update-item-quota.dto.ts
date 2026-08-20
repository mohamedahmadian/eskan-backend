import { PartialType } from '@nestjs/mapped-types';
import { CreateItemQuotaDto } from './create-item-quota.dto';

export class UpdateItemQuotaDto extends PartialType(CreateItemQuotaDto) {}
