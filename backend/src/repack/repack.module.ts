import { Module } from '@nestjs/common';
import { RepackService } from './repack.service';
import { RepackController } from './repack.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RepackController],
  providers: [RepackService],
})
export class RepackModule {}
