import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Complète app.json au moment du build. Les fichiers Firebase (push) ne sont
 * jamais versionnés : leur chemin est donné par des variables d'environnement
 * (sur EAS, des variables de type « fichier ») :
 *   GOOGLE_SERVICES_JSON       → google-services.json (Android)
 *   GOOGLE_SERVICE_INFO_PLIST  → GoogleService-Info.plist (iOS)
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServices = process.env.GOOGLE_SERVICES_JSON;
  const googleServiceInfo = process.env.GOOGLE_SERVICE_INFO_PLIST;

  return {
    ...config,
    name: config.name ?? 'Suivi_eleve',
    slug: config.slug ?? 'suivi-eleve',
    android: {
      ...config.android,
      ...(googleServices ? { googleServicesFile: googleServices } : {}),
    },
    ios: {
      ...config.ios,
      ...(googleServiceInfo ? { googleServicesFile: googleServiceInfo } : {}),
      infoPlist: {
        ...config.ios?.infoPlist,
        // Uniquement du chiffrement standard (HTTPS) : pas de déclaration d'export.
        ITSAppUsesNonExemptEncryption: false,
      },
    },
  };
};
