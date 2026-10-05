import { SetMetadata } from '@nestjs/common';

export const CLE_PARAM_ELEVE = 'paramEleve';

/**
 * Nom du paramètre de route qui porte l'id de l'élève, lu par ParentOwnsEleveGuard.
 * Par défaut : `eleveId`. Exemple : `@ParamEleve('id')` pour `GET /eleves/:id`.
 */
export const ParamEleve = (nom: string) => SetMetadata(CLE_PARAM_ELEVE, nom);
