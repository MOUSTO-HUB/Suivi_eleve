import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configurerApplication } from './app.setup.js';

async function bootstrap() {
  // Corps brut conservé : la signature des webhooks WhatsApp porte sur lui.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configurerApplication(app);
  // Une ou plusieurs origines séparées par des virgules (site web, version navigateur du mobile).
  const origines = (process.env.WEB_ORIGIN ?? 'http://localhost:3001')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origines });
  await app.listen(process.env.API_PORT ?? 3100);
}
await bootstrap();
