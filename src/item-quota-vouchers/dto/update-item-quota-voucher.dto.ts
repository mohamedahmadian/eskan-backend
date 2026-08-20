import { PartialType } from '@nestjs/mapped-types';
import { CreateItemQuotaVoucherDto } from './create-item-quota-voucher.dto';

export class UpdateItemQuotaVoucherDto extends PartialType(
  CreateItemQuotaVoucherDto,
) {}
