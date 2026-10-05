import { Module } from '@nestjs/common';
import { ResultatsController } from './resultats.controller.js';
import { ResultatsService } from './resultats.service.js';

@Module({
  controllers: [ResultatsController],
  providers: [ResultatsService],
})
export class ResultatsModule {}
