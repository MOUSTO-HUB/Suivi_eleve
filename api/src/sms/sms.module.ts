import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleSmsSender, SmsSender } from './sms.sender.js';

@Module({
  providers: [
    {
      provide: SmsSender,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SmsSender => {
        const fournisseur = config.get<string>('SMS_FOURNISSEUR', 'console');
        if (fournisseur === 'console') {
          if (config.get<string>('NODE_ENV') === 'production') {
            throw new Error(
              'SMS_FOURNISSEUR=console est interdit en production : configurez un fournisseur réel.',
            );
          }
          return new ConsoleSmsSender();
        }
        throw new Error(`Fournisseur SMS inconnu : ${fournisseur}`);
      },
    },
  ],
  exports: [SmsSender],
})
export class SmsModule {}
