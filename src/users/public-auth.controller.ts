import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RegisterIdentityCheckDto } from './dto/register-identity-check.dto';
import { SelfRegisterDto } from './dto/self-register.dto';
import { UsersService } from './users.service';

@Controller('auth')
export class PublicAuthController {
  constructor(private readonly users: UsersService) {}

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.users.forgotPasswordByIdentifier(dto.identifier, dto.channel);
  }

  @Post('register/identity-check')
  @HttpCode(HttpStatus.OK)
  checkRegisterIdentity(@Body() dto: RegisterIdentityCheckDto) {
    return this.users.checkRegisterIdentityTaken(dto);
  }

  @Post('register')
  register(@Body() dto: SelfRegisterDto) {
    return this.users.selfRegister(dto);
  }
}
