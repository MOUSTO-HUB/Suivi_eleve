-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SECRETARIAT', 'ENSEIGNANT', 'SURVEILLANT', 'COMPTABLE', 'PARENT');

-- CreateEnum
CREATE TYPE "Genre" AS ENUM ('MASCULIN', 'FEMININ');

-- CreateEnum
CREATE TYPE "StatutEleve" AS ENUM ('ACTIF', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "LienTuteur" AS ENUM ('PERE', 'MERE', 'TUTEUR_LEGAL', 'AUTRE');

-- CreateEnum
CREATE TYPE "Langue" AS ENUM ('FR', 'WO', 'EN');

-- CreateEnum
CREATE TYPE "TypeAppareil" AS ENUM ('TELEPHONE', 'TABLETTE', 'ORDINATEUR', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutAppareil" AS ENUM ('ACTIF', 'PERDU', 'TROUVE', 'CONFISQUE', 'RESTITUE');

-- CreateEnum
CREATE TYPE "TypeIncidentAppareil" AS ENUM ('DECLARE_PERDU', 'TROUVE', 'CONFISQUE', 'RESTITUE', 'USAGE_EN_CLASSE');

-- CreateEnum
CREATE TYPE "TypeEvaluation" AS ENUM ('INTERROGATION', 'DEVOIR', 'COMPOSITION', 'EXAMEN');

-- CreateEnum
CREATE TYPE "DecisionFinAnnee" AS ENUM ('ADMIS', 'REDOUBLE', 'EXCLU', 'ORIENTE');

-- CreateEnum
CREATE TYPE "TypeComportement" AS ENUM ('POSITIF', 'NEGATIF');

-- CreateEnum
CREATE TYPE "CategorieComportement" AS ENUM ('FELICITATIONS', 'ENCOURAGEMENT', 'RETARD', 'ABSENCE', 'INDISCIPLINE', 'FRAUDE', 'VIOLENCE', 'USAGE_APPAREIL', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutValidation" AS ENUM ('EN_ATTENTE', 'VALIDE', 'REJETE');

-- CreateEnum
CREATE TYPE "TypeFrais" AS ENUM ('INSCRIPTION', 'MENSUALITE', 'AUTRE');

-- CreateEnum
CREATE TYPE "MotifReduction" AS ENUM ('FRATRIE', 'BOURSE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutEcheance" AS ENUM ('A_PAYER', 'PARTIEL', 'PAYE', 'EN_RETARD');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'CHEQUE');

-- CreateEnum
CREATE TYPE "TypeAnnonce" AS ENUM ('PAS_DE_COURS', 'LIBERATION_ANTICIPEE', 'EVENEMENT');

-- CreateEnum
CREATE TYPE "MotifAnnonce" AS ENUM ('GREVE', 'COUPURE_ELECTRICITE', 'INTEMPERIES', 'ABSENCE_ENSEIGNANT', 'AUTRE');

-- CreateEnum
CREATE TYPE "CibleAnnonce" AS ENUM ('ECOLE', 'CLASSES');

-- CreateEnum
CREATE TYPE "StatutAnnonce" AS ENUM ('BROUILLON', 'PROGRAMMEE', 'ENVOYEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "TypeNotification" AS ENUM ('LIBERATION_ANTICIPEE', 'PAS_DE_COURS', 'COMPORTEMENT', 'RAPPEL_PAIEMENT', 'RETARD_PAIEMENT', 'RECU_PAIEMENT', 'RESULTATS', 'DECISION_FIN_ANNEE', 'EVENEMENT', 'USAGE_APPAREIL', 'APPAREIL');

-- CreateEnum
CREATE TYPE "CanalNotification" AS ENUM ('SMS', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "PrioriteNotification" AS ENUM ('URGENTE', 'HAUTE', 'NORMALE', 'BASSE');

-- CreateEnum
CREATE TYPE "StatutNotification" AS ENUM ('EN_FILE', 'ENVOYEE', 'DELIVREE', 'ECHOUEE', 'LUE');

-- CreateEnum
CREATE TYPE "PlateformePush" AS ENUM ('ANDROID', 'IOS', 'WEB');

-- CreateEnum
CREATE TYPE "ActionAudit" AS ENUM ('CREATION', 'MODIFICATION', 'ARCHIVAGE', 'SUPPRESSION', 'CONNEXION', 'EXPORT');

-- CreateTable
CREATE TABLE "ecoles" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "ecoles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" TEXT NOT NULL,
    "ecole_id" TEXT NOT NULL,
    "prenoms" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "role" "Role" NOT NULL,
    "mot_de_passe_hash" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "derniere_connexion" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jetons_push" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "jeton" TEXT NOT NULL,
    "plateforme" "PlateformePush" NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "jetons_push_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annees_scolaires" (
    "id" TEXT NOT NULL,
    "ecole_id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "annees_scolaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodes" (
    "id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "periodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "ecole_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "niveau" TEXT NOT NULL,
    "enseignant_principal_id" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eleves" (
    "id" TEXT NOT NULL,
    "ecole_id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "prenoms" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "genre" "Genre" NOT NULL,
    "date_naissance" DATE NOT NULL,
    "telephone" TEXT,
    "photo_url" TEXT,
    "statut" "StatutEleve" NOT NULL DEFAULT 'ACTIF',
    "date_inscription" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "classe_id" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "eleves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historique_classes" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "historique_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tuteurs" (
    "id" TEXT NOT NULL,
    "ecole_id" TEXT NOT NULL,
    "prenoms" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "contact_1" TEXT NOT NULL,
    "contact_2" TEXT,
    "email" TEXT,
    "langue" "Langue" NOT NULL DEFAULT 'FR',
    "consentement_le" TIMESTAMP(3),
    "utilisateur_id" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "tuteurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eleves_tuteurs" (
    "eleve_id" TEXT NOT NULL,
    "tuteur_id" TEXT NOT NULL,
    "lien" "LienTuteur" NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "eleves_tuteurs_pkey" PRIMARY KEY ("eleve_id","tuteur_id")
);

-- CreateTable
CREATE TABLE "appareils" (
    "id" TEXT NOT NULL,
    "ecole_id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "type" "TypeAppareil" NOT NULL,
    "marque" TEXT,
    "modele" TEXT,
    "couleur" TEXT,
    "numero_serie" TEXT,
    "imei" TEXT,
    "signes_distinctifs" TEXT,
    "photo_url" TEXT,
    "qr_code" TEXT NOT NULL,
    "statut" "StatutAppareil" NOT NULL DEFAULT 'ACTIF',
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "appareils_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents_appareil" (
    "id" TEXT NOT NULL,
    "appareil_id" TEXT NOT NULL,
    "type" "TypeIncidentAppareil" NOT NULL,
    "date_heure" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lieu" TEXT,
    "auteur_id" TEXT,
    "commentaire" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "incidents_appareil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matieres" (
    "id" TEXT NOT NULL,
    "ecole_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "coefficient" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "matieres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "matiere_id" TEXT NOT NULL,
    "periode_id" TEXT NOT NULL,
    "enseignant_id" TEXT,
    "type" "TypeEvaluation" NOT NULL,
    "titre" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "bareme" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "coefficient" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "evaluation_id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "valeur" DECIMAL(5,2),
    "absent" BOOLEAN NOT NULL DEFAULT false,
    "appreciation" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultats" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "periode_id" TEXT NOT NULL,
    "moyenne" DECIMAL(5,2),
    "rang" INTEGER,
    "appreciation" TEXT,
    "bulletin_url" TEXT,
    "publie" BOOLEAN NOT NULL DEFAULT false,
    "publie_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "resultats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions_annuelles" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "decision" "DecisionFinAnnee" NOT NULL,
    "moyenne_annuelle" DECIMAL(5,2),
    "observation" TEXT,
    "publie" BOOLEAN NOT NULL DEFAULT false,
    "publie_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "decisions_annuelles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comportements" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "type" "TypeComportement" NOT NULL,
    "categorie" "CategorieComportement" NOT NULL,
    "gravite" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "sanction" TEXT,
    "convocation_le" TIMESTAMP(3),
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" "StatutValidation" NOT NULL DEFAULT 'VALIDE',
    "auteur_id" TEXT,
    "valide_par_id" TEXT,
    "valide_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "comportements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frais" (
    "id" TEXT NOT NULL,
    "ecole_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "classe_id" TEXT,
    "type" "TypeFrais" NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "jour_echeance" INTEGER,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "frais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reductions" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "motif" "MotifReduction" NOT NULL,
    "pourcentage" INTEGER,
    "montant" INTEGER,
    "commentaire" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "reductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "echeances" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "frais_id" TEXT NOT NULL,
    "mois" DATE NOT NULL,
    "montant_du" INTEGER NOT NULL,
    "montant_paye" INTEGER NOT NULL DEFAULT 0,
    "date_limite" DATE NOT NULL,
    "statut" "StatutEcheance" NOT NULL DEFAULT 'A_PAYER',
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "echeances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements" (
    "id" TEXT NOT NULL,
    "echeance_id" TEXT NOT NULL,
    "numero_recu" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "mode" "ModePaiement" NOT NULL,
    "reference" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recu_par_id" TEXT,
    "recu_url" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "paiements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annonces" (
    "id" TEXT NOT NULL,
    "ecole_id" TEXT NOT NULL,
    "type" "TypeAnnonce" NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "motif" "MotifAnnonce",
    "motif_detail" TEXT,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3),
    "lieu" TEXT,
    "modalites" TEXT,
    "piece_jointe_url" TEXT,
    "cible" "CibleAnnonce" NOT NULL DEFAULT 'ECOLE',
    "demande_reponse" BOOLEAN NOT NULL DEFAULT false,
    "statut" "StatutAnnonce" NOT NULL DEFAULT 'BROUILLON',
    "programmee_le" TIMESTAMP(3),
    "envoyee_le" TIMESTAMP(3),
    "auteur_id" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "annonces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annonces_classes" (
    "annonce_id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "annonces_classes_pkey" PRIMARY KEY ("annonce_id","classe_id")
);

-- CreateTable
CREATE TABLE "reponses_annonce" (
    "id" TEXT NOT NULL,
    "annonce_id" TEXT NOT NULL,
    "tuteur_id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "reponse" BOOLEAN NOT NULL,
    "commentaire" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "reponses_annonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "ecole_id" TEXT NOT NULL,
    "type" "TypeNotification" NOT NULL,
    "priorite" "PrioriteNotification" NOT NULL DEFAULT 'NORMALE',
    "canal" "CanalNotification" NOT NULL,
    "tuteur_id" TEXT NOT NULL,
    "eleve_id" TEXT,
    "destinataire" TEXT NOT NULL,
    "sujet" TEXT,
    "contenu" TEXT NOT NULL,
    "statut" "StatutNotification" NOT NULL DEFAULT 'EN_FILE',
    "essais" INTEGER NOT NULL DEFAULT 0,
    "erreur" TEXT,
    "fournisseur" TEXT,
    "reference_fournisseur" TEXT,
    "cout" INTEGER,
    "source_type" TEXT,
    "source_id" TEXT,
    "cle_deduplication" TEXT,
    "envoyee_le" TIMESTAMP(3),
    "delivree_le" TIMESTAMP(3),
    "lue_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preferences_notification" (
    "id" TEXT NOT NULL,
    "tuteur_id" TEXT NOT NULL,
    "type" "TypeNotification" NOT NULL,
    "sms" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "preferences_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modeles_message" (
    "id" TEXT NOT NULL,
    "ecole_id" TEXT NOT NULL,
    "type" "TypeNotification" NOT NULL,
    "canal" "CanalNotification" NOT NULL,
    "langue" "Langue" NOT NULL DEFAULT 'FR',
    "sujet" TEXT,
    "contenu" TEXT NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "modeles_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_audit" (
    "id" TEXT NOT NULL,
    "ecole_id" TEXT NOT NULL,
    "utilisateur_id" TEXT,
    "action" "ActionAudit" NOT NULL,
    "entite" TEXT NOT NULL,
    "entite_id" TEXT,
    "details" JSONB,
    "ip" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_telephone_key" ON "utilisateurs"("telephone");

-- CreateIndex
CREATE INDEX "utilisateurs_ecole_id_role_idx" ON "utilisateurs"("ecole_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "jetons_push_jeton_key" ON "jetons_push"("jeton");

-- CreateIndex
CREATE INDEX "jetons_push_utilisateur_id_idx" ON "jetons_push"("utilisateur_id");

-- CreateIndex
CREATE UNIQUE INDEX "annees_scolaires_ecole_id_libelle_key" ON "annees_scolaires"("ecole_id", "libelle");

-- CreateIndex
CREATE UNIQUE INDEX "periodes_annee_scolaire_id_ordre_key" ON "periodes"("annee_scolaire_id", "ordre");

-- CreateIndex
CREATE INDEX "classes_ecole_id_idx" ON "classes"("ecole_id");

-- CreateIndex
CREATE UNIQUE INDEX "classes_annee_scolaire_id_nom_key" ON "classes"("annee_scolaire_id", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "eleves_matricule_key" ON "eleves"("matricule");

-- CreateIndex
CREATE INDEX "eleves_ecole_id_statut_idx" ON "eleves"("ecole_id", "statut");

-- CreateIndex
CREATE INDEX "eleves_classe_id_idx" ON "eleves"("classe_id");

-- CreateIndex
CREATE INDEX "eleves_nom_prenoms_idx" ON "eleves"("nom", "prenoms");

-- CreateIndex
CREATE INDEX "historique_classes_eleve_id_idx" ON "historique_classes"("eleve_id");

-- CreateIndex
CREATE UNIQUE INDEX "tuteurs_utilisateur_id_key" ON "tuteurs"("utilisateur_id");

-- CreateIndex
CREATE INDEX "tuteurs_nom_prenoms_idx" ON "tuteurs"("nom", "prenoms");

-- CreateIndex
CREATE UNIQUE INDEX "tuteurs_ecole_id_contact_1_key" ON "tuteurs"("ecole_id", "contact_1");

-- CreateIndex
CREATE INDEX "eleves_tuteurs_tuteur_id_idx" ON "eleves_tuteurs"("tuteur_id");

-- CreateIndex
CREATE UNIQUE INDEX "appareils_qr_code_key" ON "appareils"("qr_code");

-- CreateIndex
CREATE INDEX "appareils_numero_serie_idx" ON "appareils"("numero_serie");

-- CreateIndex
CREATE INDEX "appareils_eleve_id_idx" ON "appareils"("eleve_id");

-- CreateIndex
CREATE UNIQUE INDEX "appareils_ecole_id_imei_key" ON "appareils"("ecole_id", "imei");

-- CreateIndex
CREATE INDEX "incidents_appareil_appareil_id_date_heure_idx" ON "incidents_appareil"("appareil_id", "date_heure");

-- CreateIndex
CREATE UNIQUE INDEX "matieres_ecole_id_nom_key" ON "matieres"("ecole_id", "nom");

-- CreateIndex
CREATE INDEX "evaluations_classe_id_periode_id_idx" ON "evaluations"("classe_id", "periode_id");

-- CreateIndex
CREATE INDEX "notes_eleve_id_idx" ON "notes"("eleve_id");

-- CreateIndex
CREATE UNIQUE INDEX "notes_evaluation_id_eleve_id_key" ON "notes"("evaluation_id", "eleve_id");

-- CreateIndex
CREATE UNIQUE INDEX "resultats_eleve_id_periode_id_key" ON "resultats"("eleve_id", "periode_id");

-- CreateIndex
CREATE UNIQUE INDEX "decisions_annuelles_eleve_id_annee_scolaire_id_key" ON "decisions_annuelles"("eleve_id", "annee_scolaire_id");

-- CreateIndex
CREATE INDEX "comportements_eleve_id_date_idx" ON "comportements"("eleve_id", "date");

-- CreateIndex
CREATE INDEX "comportements_statut_idx" ON "comportements"("statut");

-- CreateIndex
CREATE INDEX "frais_annee_scolaire_id_classe_id_idx" ON "frais"("annee_scolaire_id", "classe_id");

-- CreateIndex
CREATE INDEX "reductions_eleve_id_idx" ON "reductions"("eleve_id");

-- CreateIndex
CREATE INDEX "echeances_statut_date_limite_idx" ON "echeances"("statut", "date_limite");

-- CreateIndex
CREATE UNIQUE INDEX "echeances_eleve_id_frais_id_mois_key" ON "echeances"("eleve_id", "frais_id", "mois");

-- CreateIndex
CREATE UNIQUE INDEX "paiements_numero_recu_key" ON "paiements"("numero_recu");

-- CreateIndex
CREATE INDEX "paiements_echeance_id_idx" ON "paiements"("echeance_id");

-- CreateIndex
CREATE INDEX "paiements_date_idx" ON "paiements"("date");

-- CreateIndex
CREATE INDEX "annonces_ecole_id_type_date_debut_idx" ON "annonces"("ecole_id", "type", "date_debut");

-- CreateIndex
CREATE INDEX "annonces_statut_programmee_le_idx" ON "annonces"("statut", "programmee_le");

-- CreateIndex
CREATE UNIQUE INDEX "reponses_annonce_annonce_id_tuteur_id_eleve_id_key" ON "reponses_annonce"("annonce_id", "tuteur_id", "eleve_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_cle_deduplication_key" ON "notifications"("cle_deduplication");

-- CreateIndex
CREATE INDEX "notifications_tuteur_id_cree_le_idx" ON "notifications"("tuteur_id", "cree_le");

-- CreateIndex
CREATE INDEX "notifications_statut_priorite_idx" ON "notifications"("statut", "priorite");

-- CreateIndex
CREATE INDEX "notifications_source_type_source_id_idx" ON "notifications"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "notifications_reference_fournisseur_idx" ON "notifications"("reference_fournisseur");

-- CreateIndex
CREATE UNIQUE INDEX "preferences_notification_tuteur_id_type_key" ON "preferences_notification"("tuteur_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "modeles_message_ecole_id_type_canal_langue_key" ON "modeles_message"("ecole_id", "type", "canal", "langue");

-- CreateIndex
CREATE INDEX "journal_audit_ecole_id_cree_le_idx" ON "journal_audit"("ecole_id", "cree_le");

-- CreateIndex
CREATE INDEX "journal_audit_entite_entite_id_idx" ON "journal_audit"("entite", "entite_id");

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jetons_push" ADD CONSTRAINT "jetons_push_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annees_scolaires" ADD CONSTRAINT "annees_scolaires_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodes" ADD CONSTRAINT "periodes_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "annees_scolaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "annees_scolaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_enseignant_principal_id_fkey" FOREIGN KEY ("enseignant_principal_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eleves" ADD CONSTRAINT "eleves_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eleves" ADD CONSTRAINT "eleves_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_classes" ADD CONSTRAINT "historique_classes_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_classes" ADD CONSTRAINT "historique_classes_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tuteurs" ADD CONSTRAINT "tuteurs_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tuteurs" ADD CONSTRAINT "tuteurs_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eleves_tuteurs" ADD CONSTRAINT "eleves_tuteurs_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eleves_tuteurs" ADD CONSTRAINT "eleves_tuteurs_tuteur_id_fkey" FOREIGN KEY ("tuteur_id") REFERENCES "tuteurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appareils" ADD CONSTRAINT "appareils_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appareils" ADD CONSTRAINT "appareils_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents_appareil" ADD CONSTRAINT "incidents_appareil_appareil_id_fkey" FOREIGN KEY ("appareil_id") REFERENCES "appareils"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents_appareil" ADD CONSTRAINT "incidents_appareil_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matieres" ADD CONSTRAINT "matieres_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "matieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "periodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_enseignant_id_fkey" FOREIGN KEY ("enseignant_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultats" ADD CONSTRAINT "resultats_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultats" ADD CONSTRAINT "resultats_periode_id_fkey" FOREIGN KEY ("periode_id") REFERENCES "periodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions_annuelles" ADD CONSTRAINT "decisions_annuelles_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions_annuelles" ADD CONSTRAINT "decisions_annuelles_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "annees_scolaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comportements" ADD CONSTRAINT "comportements_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comportements" ADD CONSTRAINT "comportements_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comportements" ADD CONSTRAINT "comportements_valide_par_id_fkey" FOREIGN KEY ("valide_par_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frais" ADD CONSTRAINT "frais_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frais" ADD CONSTRAINT "frais_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "annees_scolaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frais" ADD CONSTRAINT "frais_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reductions" ADD CONSTRAINT "reductions_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reductions" ADD CONSTRAINT "reductions_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "annees_scolaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "echeances" ADD CONSTRAINT "echeances_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "echeances" ADD CONSTRAINT "echeances_frais_id_fkey" FOREIGN KEY ("frais_id") REFERENCES "frais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_echeance_id_fkey" FOREIGN KEY ("echeance_id") REFERENCES "echeances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_recu_par_id_fkey" FOREIGN KEY ("recu_par_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annonces" ADD CONSTRAINT "annonces_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annonces" ADD CONSTRAINT "annonces_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annonces_classes" ADD CONSTRAINT "annonces_classes_annonce_id_fkey" FOREIGN KEY ("annonce_id") REFERENCES "annonces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annonces_classes" ADD CONSTRAINT "annonces_classes_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponses_annonce" ADD CONSTRAINT "reponses_annonce_annonce_id_fkey" FOREIGN KEY ("annonce_id") REFERENCES "annonces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponses_annonce" ADD CONSTRAINT "reponses_annonce_tuteur_id_fkey" FOREIGN KEY ("tuteur_id") REFERENCES "tuteurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponses_annonce" ADD CONSTRAINT "reponses_annonce_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tuteur_id_fkey" FOREIGN KEY ("tuteur_id") REFERENCES "tuteurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "eleves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferences_notification" ADD CONSTRAINT "preferences_notification_tuteur_id_fkey" FOREIGN KEY ("tuteur_id") REFERENCES "tuteurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modeles_message" ADD CONSTRAINT "modeles_message_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_ecole_id_fkey" FOREIGN KEY ("ecole_id") REFERENCES "ecoles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
