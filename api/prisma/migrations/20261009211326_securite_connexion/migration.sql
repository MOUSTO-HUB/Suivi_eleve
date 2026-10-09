-- CreateEnum
CREATE TYPE "MethodeDoubleAuth" AS ENUM ('APPLICATION', 'EMAIL');

-- CreateEnum
CREATE TYPE "ButCodeVerification" AS ENUM ('DOUBLE_AUTH', 'REINITIALISATION');

-- AlterTable
ALTER TABLE "utilisateurs" ADD COLUMN     "blocages" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bloque_jusqu_a" TIMESTAMP(3),
ADD COLUMN     "codes_secours" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "double_auth" "MethodeDoubleAuth",
ADD COLUMN     "echecs_connexion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totp_dernier_pas" INTEGER,
ADD COLUMN     "totp_secret" TEXT,
ADD COLUMN     "verrouille_le" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "codes_verification" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "but" "ButCodeVerification" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "essais" INTEGER NOT NULL DEFAULT 0,
    "consomme_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codes_verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codes_verification_utilisateur_id_but_cree_le_idx" ON "codes_verification"("utilisateur_id", "but", "cree_le");

-- CreateIndex
CREATE INDEX "codes_verification_code_hash_idx" ON "codes_verification"("code_hash");

-- AddForeignKey
ALTER TABLE "codes_verification" ADD CONSTRAINT "codes_verification_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
