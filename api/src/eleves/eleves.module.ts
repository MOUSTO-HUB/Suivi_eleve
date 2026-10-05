import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module.js';
import { ElevesController } from './eleves.controller.js';
import { DonneesService } from './donnees.service.js';
import { ElevesService } from './eleves.service.js';
import { ImportExportService } from './import-export.service.js';

@Module({
  imports: [ClassesModule],
  controllers: [ElevesController],
  providers: [ElevesService, ImportExportService, DonneesService],
  exports: [ElevesService],
})
export class ElevesModule {}
