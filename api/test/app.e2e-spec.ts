import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/sante (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/sante')
      .expect(200)
      .expect({ statut: 'ok', service: 'suivi_eleve-api' });
  });

  afterEach(async () => {
    await app.close();
  });
});
