import { Controller, Get } from '@nestjs/common';
import { AppService, type EtatSante } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('sante')
  getSante(): EtatSante {
    return this.appService.getSante();
  }
}
