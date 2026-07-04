import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { HelpRegistry } from './help.registry';

@Controller('api/help')
export class HelpController {
  constructor(private readonly registry: HelpRegistry) {}

  /** List all registered modules with a short description */
  @Get()
  index() {
    return {
      message: 'Srivani BOS Help Centre — use GET /api/help/:module for full details',
      modules: this.registry.index(),
    };
  }

  /** Full help for a specific module */
  @Get(':module')
  module(@Param('module') moduleKey: string) {
    const help = this.registry.get(moduleKey);
    if (!help) {
      throw new NotFoundException(
        `No help found for module "${moduleKey}". Try GET /api/help for the full list.`,
      );
    }
    return help;
  }
}
