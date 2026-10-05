import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configurerApplication } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configurerApplication(app);
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3001' });
  await app.listen(process.env.API_PORT ?? 3000);
}
await bootstrap();
