import { PartialType } from '@nestjs/mapped-types';
import { CreateIceVoucherDto } from './create-ice-voucher.dto';

export class UpdateIceVoucherDto extends PartialType(CreateIceVoucherDto) {}
