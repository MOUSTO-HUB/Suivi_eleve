import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppareilsModule } from './appareils/appareils.module.js';
import { AppService } from './app.service.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ClassesModule } from './classes/classes.module.js';
import { ElevesModule } from './eleves/eleves.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StockageModule } from './stockage/stockage.module.js';
import { TuteursModule } from './tuteurs/tuteurs.module.js';

@Module({
  imports: [
    // Le .env est à la racine du monorepo ; api/.env reste possible en local.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
    PrismaModule,
    AuditModule,
    NotificationsModule,
    StockageModule,
    AuthModule,
    ClassesModule,
    TuteursModule,
    ElevesModule,
    AppareilsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
