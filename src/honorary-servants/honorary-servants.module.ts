import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { HonoraryServiceTypesController } from './honorary-service-types.controller';
import { HonoraryServantsController } from './honorary-servants.controller';
import { HonoraryServantsService } from './honorary-servants.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [HonoraryServantsController, HonoraryServiceTypesController],
  providers: [HonoraryServantsService],
})
export class HonoraryServantsModule {}
