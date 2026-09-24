import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSmsSettingsDto {
  @IsBoolean()
  isActive: boolean;

  @IsString()
  @MinLength(8)
  endpoint: string;

  @IsString()
  @MinLength(3)
  senderNumber: string;

  @IsString()
  @MinLength(1)
  username: string;

  @IsOptional()
  @IsString()
  password?: string;
}
