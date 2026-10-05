import { Module } from '@nestjs/common';
import { ComportementsController } from './comportements.controller.js';
import { ComportementsService } from './comportements.service.js';

@Module({
  controllers: [ComportementsController],
  providers: [ComportementsService],
})
export class ComportementsModule {}
