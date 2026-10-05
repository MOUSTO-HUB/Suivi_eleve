import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { memoriserRequete } from './securite/contexte-requete.js';

/** Configuration commune à main.ts et aux tests e2e. */
export function configurerApplication(app: INestApplication): void {
  const express = app as NestExpressApplication;
  // IP réelle du client derrière le proxy (Caddy) ou le serveur du site :
  // seuls les relais du réseau local ou privé sont crus (X-Forwarded-For).
  express.set('trust proxy', 'loopback, uniquelocal');
  // En-têtes de sécurité ; l'API ne sert que du JSON et des fichiers.
  express.use(
    helmet({
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  express.use(memoriserRequete);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
