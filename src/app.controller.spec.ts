import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { CaravansService } from './caravans/caravans.service';
import { UsersService } from './users/users.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: UsersService, useValue: { countByRole: async () => 0 } },
        { provide: CaravansService, useValue: { count: async () => 0 } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return ok', () => {
      expect(appController.health()).toEqual({ status: 'ok' });
    });
  });
});
