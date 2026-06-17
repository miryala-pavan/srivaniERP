import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { BankController } from './bank.controller';
import { BankService } from './bank.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } }), // 5 MB
  ],
  controllers: [BankController],
  providers:   [BankService],
  exports:     [BankService],
})
export class BankModule {}
