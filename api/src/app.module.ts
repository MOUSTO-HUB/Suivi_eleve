import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    // Le .env est à la racine du monorepo ; api/.env reste possible en local.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
