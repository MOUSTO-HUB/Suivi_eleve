/*
  Warnings:

  - You are about to drop the `echeances` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `evaluations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `frais` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `paiements` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reductions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "echeances" DROP CONSTRAINT "echeances_eleve_id_fkey";

-- DropForeignKey
ALTER TABLE "echeances" DROP CONSTRAINT "echeances_frais_id_fkey";

-- DropForeignKey
ALTER TABLE "evaluations" DROP CONSTRAINT "evaluations_classe_id_fkey";

-- DropForeignKey
ALTER TABLE "evaluations" DROP CONSTRAINT "evaluations_enseignant_id_fkey";

-- DropForeignKey
ALTER TABLE "evaluations" DROP CONSTRAINT "evaluations_matiere_id_fkey";

-- DropForeignKey
ALTER TABLE "evaluations" DROP CONSTRAINT "evaluations_periode_id_fkey";

-- DropForeignKey
ALTER TABLE "frais" DROP CONSTRAINT "frais_annee_scolaire_id_fkey";

-- DropForeignKey
ALTER TABLE "frais" DROP CONSTRAINT "frais_classe_id_fkey";

-- DropForeignKey
ALTER TABLE "frais" DROP CONSTRAINT "frais_ecole_id_fkey";

-- DropForeignKey
ALTER TABLE "notes" DROP CONSTRAINT "notes_eleve_id_fkey";

-- DropForeignKey
ALTER TABLE "notes" DROP CONSTRAINT "notes_evaluation_id_fkey";

-- DropForeignKey
ALTER TABLE "paiements" DROP CONSTRAINT "paiements_echeance_id_fkey";

-- DropForeignKey
ALTER TABLE "paiements" DROP CONSTRAINT "paiements_recu_par_id_fkey";

-- DropForeignKey
ALTER TABLE "reductions" DROP CONSTRAINT "reductions_annee_scolaire_id_fkey";

-- DropForeignKey
ALTER TABLE "reductions" DROP CONSTRAINT "reductions_eleve_id_fkey";

-- DropTable
DROP TABLE "echeances";

-- DropTable
DROP TABLE "evaluations";

-- DropTable
DROP TABLE "frais";

-- DropTable
DROP TABLE "notes";

-- DropTable
DROP TABLE "paiements";

-- DropTable
DROP TABLE "reductions";

-- DropEnum
DROP TYPE "ModePaiement";

-- DropEnum
DROP TYPE "MotifReduction";

-- DropEnum
DROP TYPE "StatutEcheance";

-- DropEnum
DROP TYPE "TypeEvaluation";

-- DropEnum
DROP TYPE "TypeFrais";
