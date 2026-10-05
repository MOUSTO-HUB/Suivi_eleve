import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module.js';
import { ElevesController } from './eleves.controller.js';
import { ElevesService } from './eleves.service.js';
import { ImportExportService } from './import-export.service.js';

@Module({
  imports: [ClassesModule],
  controllers: [ElevesController],
  providers: [ElevesService, ImportExportService],
  exports: [ElevesService],
})
export class ElevesModule {}
