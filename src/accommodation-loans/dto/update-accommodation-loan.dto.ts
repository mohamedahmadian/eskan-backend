import { PartialType } from '@nestjs/mapped-types';
import { CreateAccommodationLoanDto } from './create-accommodation-loan.dto';

export class UpdateAccommodationLoanDto extends PartialType(
  CreateAccommodationLoanDto,
) {}
