import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../package.json');

@Controller()
export class AppController {
  constructor(private prisma: PrismaService) {}

  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status:    'ok',
      timestamp: new Date().toISOString(),
      database:  'connected',
      service:   'Srivani Stores ERP',
      version,
    };
  }
}
