-- CreateTable
CREATE TABLE "jetons_rafraichissement" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "jeton_hash" TEXT NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "revoque_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "jetons_rafraichissement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codes_otp" (
    "id" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "essais" INTEGER NOT NULL DEFAULT 0,
    "consomme_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "codes_otp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jetons_rafraichissement_jeton_hash_key" ON "jetons_rafraichissement"("jeton_hash");

-- CreateIndex
CREATE INDEX "jetons_rafraichissement_utilisateur_id_idx" ON "jetons_rafraichissement"("utilisateur_id");

-- CreateIndex
CREATE INDEX "codes_otp_telephone_cree_le_idx" ON "codes_otp"("telephone", "cree_le");

-- AddForeignKey
ALTER TABLE "jetons_rafraichissement" ADD CONSTRAINT "jetons_rafraichissement_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
