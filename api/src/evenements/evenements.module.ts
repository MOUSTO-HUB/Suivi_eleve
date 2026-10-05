import { Module } from '@nestjs/common';
import { AnnoncesModule } from '../annonces/annonces.module.js';
import { ClassesModule } from '../classes/classes.module.js';
import { EvenementsController } from './evenements.controller.js';
import { EvenementsService } from './evenements.service.js';

@Module({
  imports: [AnnoncesModule, ClassesModule],
  controllers: [EvenementsController],
  providers: [EvenementsService],
})
export class EvenementsModule {}
