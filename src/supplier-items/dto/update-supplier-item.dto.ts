import { PartialType } from '@nestjs/mapped-types';
import { CreateSupplierItemDto } from './create-supplier-item.dto';

export class UpdateSupplierItemDto extends PartialType(CreateSupplierItemDto) {}
