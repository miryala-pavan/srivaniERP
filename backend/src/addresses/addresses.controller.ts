import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { StorefrontJwtGuard } from '../storefront-auth/guards/storefront-jwt.guard';

@Controller('addresses')
@UseGuards(StorefrontJwtGuard)
export class AddressesController {
  constructor(private readonly service: AddressesService) {}

  @Get()
  list(@Request() req: any) {
    return this.service.list(req.verifiedPhone);
  }

  @Post()
  create(@Body() dto: CreateAddressDto, @Request() req: any) {
    return this.service.create(req.verifiedPhone, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAddressDto, @Request() req: any) {
    return this.service.update(id, req.verifiedPhone, dto);
  }

  @Patch(':id/default')
  setDefault(@Param('id') id: string, @Request() req: any) {
    return this.service.setDefault(id, req.verifiedPhone);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.verifiedPhone);
  }
}
