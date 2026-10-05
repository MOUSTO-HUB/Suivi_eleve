-- CreateEnum
CREATE TYPE "StatutRappel" AS ENUM ('EN_COURS', 'REGLE');

-- CreateTable
CREATE TABLE "rappels_paiement" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "date_echeance" DATE NOT NULL,
    "statut" "StatutRappel" NOT NULL DEFAULT 'EN_COURS',
    "nombre_envois" INTEGER NOT NULL DEFAULT 0,
    "dernier_envoi_le" TIMESTAMP(3),
    "regle_le" TIMESTAMP(3),
    "auteur_id" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "rappels_paiement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rappels_paiement_eleve_id_statut_idx" ON "rappels_paiement"("eleve_id", "statut");

-- CreateIndex
CREATE INDEX "rappels_paiement_statut_date_echeance_idx" ON "rappels_paiement"("statut", "date_echeance");

-- AddForeignKey
ALTER TABLE "rappels_paiement" ADD CONSTRAINT "rappels_paiement_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rappels_paiement" ADD CONSTRAINT "rappels_paiement_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
