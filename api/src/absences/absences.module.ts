import { Module } from '@nestjs/common';
import { AbsencesController } from './absences.controller.js';
import { AbsencesService } from './absences.service.js';

@Module({
  controllers: [AbsencesController],
  providers: [AbsencesService],
})
export class AbsencesModule {}
