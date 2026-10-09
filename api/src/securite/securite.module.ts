import { Global, Module } from '@nestjs/common';
import { AltchaService } from './altcha.service.js';
import { LimiteurService } from './limiteur.service.js';

@Global()
@Module({
  providers: [LimiteurService, AltchaService],
  exports: [LimiteurService, AltchaService],
})
export class SecuriteModule {}
