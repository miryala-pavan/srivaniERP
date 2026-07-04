import { Module, OnModuleInit } from '@nestjs/common';
import { TdsService } from './tds.service';
import { TdsController } from './tds.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RuleEngineModule } from '../platform/rule-engine/rule-engine.module';
import { HelpModule } from '../platform/help/help.module';
import { HelpRegistry } from '../platform/help/help.registry';
import { TDS_HELP } from './tds.help';

@Module({
  imports: [PrismaModule, RuleEngineModule, HelpModule],
  providers: [TdsService],
  controllers: [TdsController],
  exports: [TdsService],
})
export class TdsModule implements OnModuleInit {
  constructor(private readonly helpRegistry: HelpRegistry) {}

  onModuleInit() {
    this.helpRegistry.register(TDS_HELP);
  }
}
