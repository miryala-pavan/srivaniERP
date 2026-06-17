import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, BadRequestException,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly service: AddressesService) {}

  @Get()
  list(@Query('phone') phone?: string) {
    if (!phone) throw new BadRequestException('phone query param required');
    return this.service.list(phone);
  }

  @Post()
  create(@Body() dto: CreateAddressDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Query('phone') phone: string,
    @Body() dto: UpdateAddressDto,
  ) {
    if (!phone) throw new BadRequestException('phone query param required');
    return this.service.update(id, phone, dto);
  }

  @Patch(':id/default')
  setDefault(@Param('id') id: string, @Query('phone') phone: string) {
    if (!phone) throw new BadRequestException('phone query param required');
    return this.service.setDefault(id, phone);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('phone') phone: string) {
    if (!phone) throw new BadRequestException('phone query param required');
    return this.service.remove(id, phone);
  }
}
