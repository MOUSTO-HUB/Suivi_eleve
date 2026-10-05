-- CreateTable
CREATE TABLE "enseignements" (
    "id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "matiere_id" TEXT NOT NULL,
    "enseignant_id" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "enseignements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moyennes_matieres" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "periode_id" TEXT NOT NULL,
    "matiere_id" TEXT NOT NULL,
    "moyenne" DECIMAL(5,2),
    "appreciation" TEXT,
    "saisie_par_id" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "moyennes_matieres_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enseignements_enseignant_id_idx" ON "enseignements"("enseignant_id");

-- CreateIndex
CREATE UNIQUE INDEX "enseignements_classe_id_matiere_id_key" ON "enseignements"("classe_id", "matiere_id");

-- CreateIndex
CREATE INDEX "moyennes_matieres_periode_id_matiere_id_idx" ON "moyennes_matieres"("periode_id", "matiere_id");

-- CreateIndex
CREATE UNIQUE INDEX "moyennes_matieres_eleve_id_periode_id_matiere_id_key" ON "moyennes_matieres"("eleve_id", "periode_id", "matiere_id");

-- AddForeignKey
ALTER TABLE "enseignements" ADD CONSTRAINT "enseignements_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enseignements" ADD CONSTRAINT "enseignements_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "matieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enseignements" ADD CONSTRAINT "enseignements_enseignant_id_fkey" FOREIGN KEY ("enseignant_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moyennes_matieres" ADD CONSTRAINT "moyennes_matieres_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moyennes_matieres" ADD CONSTRAINT "moyennes_matieres_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "periodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moyennes_matieres" ADD CONSTRAINT "moyennes_matieres_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "matieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moyennes_matieres" ADD CONSTRAINT "moyennes_matieres_saisie_par_id_fkey" FOREIGN KEY ("saisie_par_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
