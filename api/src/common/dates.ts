/** Date calendaire « AAAA-MM-JJ » (colonnes @db.Date, stockées à minuit UTC). */
export const versJour = (date: Date): string => date.toISOString().slice(0, 10);

/** « AAAA-MM-JJ » → Date à minuit UTC. */
export const depuisJour = (jour: string): Date =>
  new Date(`${jour}T00:00:00.000Z`);

/** Âge en années révolues à la date donnée (jamais stocké : toujours calculé). */
export function calculerAge(
  dateNaissance: Date,
  aujourdHui = new Date(),
): number {
  let age = aujourdHui.getUTCFullYear() - dateNaissance.getUTCFullYear();
  const anniversairePasse =
    aujourdHui.getUTCMonth() > dateNaissance.getUTCMonth() ||
    (aujourdHui.getUTCMonth() === dateNaissance.getUTCMonth() &&
      aujourdHui.getUTCDate() >= dateNaissance.getUTCDate());
  if (!anniversairePasse) age--;
  return age;
}
