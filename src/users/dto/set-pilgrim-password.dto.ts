import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class SetPilgrimPasswordDto {
  @IsString()
  @MinLength(8, { message: 'رمز عبور باید حداقل ۸ کاراکتر باشد' })
  password: string;

  @IsOptional()
  @IsBoolean()
  sendSms?: boolean;
}
