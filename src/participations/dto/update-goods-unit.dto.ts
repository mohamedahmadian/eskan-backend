import { PartialType } from '@nestjs/mapped-types';
import { CreateGoodsUnitDto } from './create-goods-unit.dto';

export class UpdateGoodsUnitDto extends PartialType(CreateGoodsUnitDto) {}
