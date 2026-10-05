import { Controller, Get } from '@nestjs/common';
import { AppService, type EtatSante } from './app.service.js';
import { Public } from './auth/decorators/public.decorator.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('sante')
  getSante(): EtatSante {
    return this.appService.getSante();
  }
}
