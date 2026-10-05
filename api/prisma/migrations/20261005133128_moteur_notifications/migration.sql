-- Canal APPLICATION : historique des messages consultable par le parent.
ALTER TYPE "CanalNotification" ADD VALUE 'APPLICATION';

-- lot_id regroupe les lignes (une par canal) d'un même message.
-- Les notifications déjà en base reçoivent chacune leur propre lot.
ALTER TABLE "notifications" ADD COLUMN "lot_id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "notifications" ALTER COLUMN "lot_id" DROP DEFAULT;

CREATE INDEX "notifications_lot_id_idx" ON "notifications"("lot_id");
CREATE INDEX "notifications_ecole_id_canal_cree_le_idx" ON "notifications"("ecole_id", "canal", "cree_le");
