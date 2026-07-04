import { Module, OnModuleInit } from '@nestjs/common';
import { LedgerApiController } from './ledger-api.controller';
import { LedgerModule } from '../platform/ledger/ledger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HelpModule } from '../platform/help/help.module';
import { HelpRegistry } from '../platform/help/help.registry';
import { LEDGER_API_HELP } from './ledger-api.help';

@Module({
  imports: [PrismaModule, LedgerModule, HelpModule],
  controllers: [LedgerApiController],
})
export class LedgerApiModule implements OnModuleInit {
  constructor(private readonly helpRegistry: HelpRegistry) {}

  onModuleInit() {
    this.helpRegistry.register(LEDGER_API_HELP);
  }
}
