import { SetMetadata } from '@nestjs/common';

export const CLE_OUVERT_AU_CONCEPTEUR = 'ouvertAuConcepteur';

/**
 * Route sans @Roles que le concepteur (SUPER_ADMIN) peut aussi utiliser, parce
 * qu'elle ne touche que son propre compte (ex. son profil).
 */
export const OuvertAuConcepteur = () =>
  SetMetadata(CLE_OUVERT_AU_CONCEPTEUR, true);
