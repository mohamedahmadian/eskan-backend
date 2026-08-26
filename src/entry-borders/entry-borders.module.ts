import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EntryBordersController } from './entry-borders.controller';
import { EntryBordersService } from './entry-borders.service';

@Module({
  imports: [AuthModule],
  controllers: [EntryBordersController],
  providers: [EntryBordersService],
})
export class EntryBordersModule {}
