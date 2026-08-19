import { ArrayMinSize, IsArray, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class SendSmsDto {
  @ValidateIf((dto: SendSmsDto) => !dto.phones?.length)
  @IsString()
  @MinLength(10)
  phone?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  phones?: string[];

  @IsString()
  @MinLength(1)
  body: string;
}
