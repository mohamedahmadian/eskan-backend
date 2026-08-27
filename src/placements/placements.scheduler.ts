import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PlacementsService } from './placements.service';

@Injectable()
export class PlacementsScheduler {
  private readonly logger = new Logger(PlacementsScheduler.name);

  constructor(private readonly placements: PlacementsService) {}

  @Cron('10 0 * * *', { timeZone: 'Asia/Tehran' })
  async vacateDueStays() {
    const result = await this.placements.vacateDue(null);
    this.logger.log(`placement.vacateDue vacated=${result.vacated}`);
  }
}
