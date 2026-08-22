import {
  Controller, Get, Post, Param, Body, UseGuards, UseInterceptors, UploadedFile, Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { OrderPhotosService } from './order-photos.service';
import { CreateOrderPhotoDto } from './dto/create-order-photo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const STAFF_ROLES = [
  'SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON',
  'FLOOR_SUPERVISOR', 'SALES_REP', 'CASHIER',
];

@Controller('order-photos')
export class OrderPhotosController {
  constructor(private orderPhotosService: OrderPhotosService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  upload(
    @Request() req: any,
    @Body() dto: CreateOrderPhotoDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new Error('No file uploaded');
    return this.orderPhotosService.upload(req.user.businessId, dto, file);
  }

  // Public — no auth — the unguessable token IS the access control
  @Get(':token')
  getByToken(@Param('token') token: string) {
    return this.orderPhotosService.getByToken(token);
  }
}
