import { Injectable } from '@nestjs/common';

export interface EtatSante {
  statut: 'ok';
  service: string;
}

@Injectable()
export class AppService {
  getSante(): EtatSante {
    return { statut: 'ok', service: 'suivi_eleve-api' };
  }
}
