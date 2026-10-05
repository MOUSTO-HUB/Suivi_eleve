import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module.js';
import { AnnoncesController } from './annonces.controller.js';
import { AnnoncesService } from './annonces.service.js';

@Module({
  imports: [ClassesModule],
  controllers: [AnnoncesController],
  providers: [AnnoncesService],
})
export class AnnoncesModule {}
