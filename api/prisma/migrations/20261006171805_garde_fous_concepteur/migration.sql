-- DropForeignKey
ALTER TABLE "journal_audit" DROP CONSTRAINT "journal_audit_ecole_id_fkey";

-- DropForeignKey
ALTER TABLE "utilisateurs" DROP CONSTRAINT "utilisateurs_ecole_id_fkey";

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seul le concepteur (SUPER_ADMIN) est sans école ; tout autre compte en a une.
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_ecole_selon_role"
  CHECK (("role" = 'SUPER_ADMIN') = ("ecole_id" IS NULL));
