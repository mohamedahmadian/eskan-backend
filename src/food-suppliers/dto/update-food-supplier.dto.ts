import { PartialType } from '@nestjs/mapped-types';
import { CreateFoodSupplierDto } from './create-food-supplier.dto';

export class UpdateFoodSupplierDto extends PartialType(CreateFoodSupplierDto) {}
