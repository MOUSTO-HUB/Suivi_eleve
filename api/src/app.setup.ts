import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Configuration commune à main.ts et aux tests e2e. */
export function configurerApplication(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
