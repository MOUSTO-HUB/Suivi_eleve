-- AlterEnum
ALTER TYPE "TypeNotification" ADD VALUE 'ABSENCE';

-- AlterTable
ALTER TABLE "annonces" ADD COLUMN     "creneau" TEXT;

-- CreateTable
CREATE TABLE "absences" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "creneau" TEXT NOT NULL,
    "matiere" TEXT,
    "justifiee" BOOLEAN NOT NULL DEFAULT false,
    "motif" TEXT,
    "justification_parent" TEXT,
    "justifiee_le" TIMESTAMP(3),
    "justifiee_par_id" TEXT,
    "signale_par_id" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "absences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "absences_date_idx" ON "absences"("date");

-- CreateIndex
CREATE UNIQUE INDEX "absences_eleve_id_date_creneau_key" ON "absences"("eleve_id", "date", "creneau");

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_signale_par_id_fkey" FOREIGN KEY ("signale_par_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_justifiee_par_id_fkey" FOREIGN KEY ("justifiee_par_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
