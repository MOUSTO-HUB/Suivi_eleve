import { Module } from '@nestjs/common';
import { MatieresController } from './matieres.controller.js';
import { MatieresService } from './matieres.service.js';

@Module({
  controllers: [MatieresController],
  providers: [MatieresService],
})
export class MatieresModule {}
