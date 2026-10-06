-- CreateEnum
CREATE TYPE "Pays" AS ENUM ('GN', 'CI', 'SN');

-- CreateEnum
CREATE TYPE "FormuleAbonnement" AS ENUM ('MENSUEL', 'ANNUEL');

-- CreateEnum
CREATE TYPE "MoyenPaiementAbonnement" AS ENUM ('ORANGE_MONEY', 'MTN_MOBILE_MONEY', 'WAVE', 'VIREMENT', 'ESPECES', 'AUTRE');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- DropForeignKey
ALTER TABLE "journal_audit" DROP CONSTRAINT "journal_audit_ecole_id_fkey";

-- DropForeignKey
ALTER TABLE "utilisateurs" DROP CONSTRAINT "utilisateurs_ecole_id_fkey";

-- AlterTable
ALTER TABLE "ecoles" ADD COLUMN     "fin_abonnement" DATE NOT NULL DEFAULT (CURRENT_DATE + 29),
ADD COLUMN     "motif_suspension" TEXT,
ADD COLUMN     "pays" "Pays" NOT NULL DEFAULT 'SN',
ADD COLUMN     "suspendue_le" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "journal_audit" ALTER COLUMN "ecole_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "utilisateurs" ALTER COLUMN "ecole_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "paiements_abonnement" (
    "id" TEXT NOT NULL,
    "ecole_id" TEXT NOT NULL,
    "formule" "FormuleAbonnement" NOT NULL,
    "montant" INTEGER NOT NULL,
    "moyen" "MoyenPaiementAbonnement" NOT NULL,
    "reference" TEXT,
    "paye_le" DATE NOT NULL,
    "periode_debut" DATE NOT NULL,
    "periode_fin" DATE NOT NULL,
    "enregistre_par" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paiements_abonnement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "paiements_abonnement_ecole_id_paye_le_idx" ON "paiements_abonnement"("ecole_id", "paye_le");

-- CreateIndex
CREATE INDEX "paiements_abonnement_paye_le_idx" ON "paiements_abonnement"("paye_le");

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_abonnement" ADD CONSTRAINT "paiements_abonnement_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_abonnement" ADD CONSTRAINT "paiements_abonnement_enregistre_par_fkey" FOREIGN KEY ("enregistre_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
