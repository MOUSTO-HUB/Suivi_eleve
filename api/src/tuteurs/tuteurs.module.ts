import { Module } from '@nestjs/common';
import { TuteursController } from './tuteurs.controller.js';
import { TuteursService } from './tuteurs.service.js';

@Module({
  controllers: [TuteursController],
  providers: [TuteursService],
  exports: [TuteursService],
})
export class TuteursModule {}
