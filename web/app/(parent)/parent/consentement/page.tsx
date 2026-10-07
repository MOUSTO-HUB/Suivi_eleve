import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormulaireAction } from '@/components/formulaire-action';
import { Carte } from '@/components/ui';
import { profilCourant } from '@/lib/profil';
import { consentir } from '../actions';

export const metadata: Metadata = { title: 'Vos données · Suivi_eleve' };

/** À la première connexion (ou si le texte change) : information et accord du tuteur. */
export default async function PageConsentement() {
  const profil = await profilCourant();
  if (!profil.consentement || profil.consentement.accepte) redirect('/parent');
  const { version, texte } = profil.consentement;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Bienvenue {profil.prenoms}
      </h1>
      <p className="text-slate-600">
        Avant de commencer, merci de lire comment l&apos;école utilise vos
        données et celles de votre enfant.
      </p>
      <Carte>
        <div className="flex flex-col gap-3 text-base leading-relaxed">
          {texte.map((paragraphe) => (
            <p key={paragraphe}>{paragraphe}</p>
          ))}
        </div>
      </Carte>
      <FormulaireAction
        action={consentir.bind(null, version)}
        libelle="J'ai lu et j'accepte"
        libelleEnCours="Enregistrement…"
      />
    </div>
  );
}
