import { Module } from '@nestjs/common';
import { JournalBridgeService } from './journal-bridge.service';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  providers: [JournalBridgeService],
  exports: [JournalBridgeService],
})
export class JournalBridgeModule {}
