import { Module } from '@nestjs/common';
import { HelpRegistry } from './help.registry';
import { HelpController } from './help.controller';

@Module({
  providers: [HelpRegistry],
  controllers: [HelpController],
  exports: [HelpRegistry],
})
export class HelpModule {}
