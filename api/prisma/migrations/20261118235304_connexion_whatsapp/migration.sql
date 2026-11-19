-- CreateTable
CREATE TABLE "demandes_connexion_whatsapp" (
    "id" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "jeton_hash" TEXT NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "validee_le" TIMESTAMP(3),
    "consomme_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "demandes_connexion_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "demandes_connexion_whatsapp_jeton_hash_key" ON "demandes_connexion_whatsapp"("jeton_hash");

-- CreateIndex
CREATE INDEX "demandes_connexion_whatsapp_telephone_cree_le_idx" ON "demandes_connexion_whatsapp"("telephone", "cree_le");
