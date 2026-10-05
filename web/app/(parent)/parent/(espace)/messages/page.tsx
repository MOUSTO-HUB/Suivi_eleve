import type { Metadata } from 'next';
import { LigneMessage, TitreParent, Vide } from '@/components/parent';
import { Pagination, parametre } from '@/components/ui';
import { lireApi } from '@/lib/api';
import type { MesNotifications } from '@/lib/types';

export const metadata: Metadata = { title: 'Messages · Suivi_eleve' };

export default async function Messages(props: PageProps<'/parent/messages'>) {
  const page = parametre((await props.searchParams).page) ?? '1';
  const messages = await lireApi<MesNotifications>(
    `/notifications/mes?parPage=20&page=${encodeURIComponent(page)}`,
  );
  return (
    <>
      <TitreParent
        titre="Messages de l'école"
        sousTitre={
          messages.nonLues > 0
            ? `${messages.nonLues} message(s) non lu(s)`
            : 'Tous vos messages sont lus.'
        }
      />
      {messages.elements.length === 0 ? (
        <Vide>Aucun message de l&apos;école pour le moment.</Vide>
      ) : (
        <ul className="flex flex-col gap-2">
          {messages.elements.map((n) => (
            <li key={n.id}>
              <LigneMessage n={n} />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={messages.page}
        pages={messages.pages}
        total={messages.total}
        chemin="/parent/messages"
        parametres={{}}
      />
    </>
  );
}
