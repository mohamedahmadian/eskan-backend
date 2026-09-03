import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum InsurancePaymentMethod {
  ONLINE = 'ONLINE',
  RECEIPT = 'RECEIPT',
}

export class PayReservationInsuranceDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  memberIds: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(36)
  insurancePlanId: string;

  @IsOptional()
  @IsEnum(InsurancePaymentMethod)
  method?: InsurancePaymentMethod;

  @ValidateIf((dto) => dto.method === InsurancePaymentMethod.RECEIPT)
  @IsDateString()
  receiptDate?: string;

  @ValidateIf((dto) => dto.method === InsurancePaymentMethod.RECEIPT)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  receiptTrackingNo?: string;

  @ValidateIf((dto) => dto.method === InsurancePaymentMethod.RECEIPT)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  receiptBankName?: string;
}
