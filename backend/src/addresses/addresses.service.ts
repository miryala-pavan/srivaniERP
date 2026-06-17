import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(phone: string) {
    return this.prisma.storefrontAddress.findMany({
      where: { phone },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(dto: CreateAddressDto) {
    const count = await this.prisma.storefrontAddress.count({
      where: { phone: dto.phone },
    });
    if (count >= 10) {
      throw new BadRequestException('Maximum 10 saved addresses allowed');
    }

    const makeDefault = dto.isDefault ?? count === 0;

    if (makeDefault) {
      await this.prisma.storefrontAddress.updateMany({
        where: { phone: dto.phone, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.storefrontAddress.create({
      data: {
        phone: dto.phone,
        label: dto.label ?? 'Home',
        line1: dto.line1,
        line2: dto.line2 ?? null,
        city: dto.city,
        pincode: dto.pincode,
        state: dto.state ?? 'Telangana',
        isDefault: makeDefault,
      },
    });
  }

  private async findOwned(id: string, phone: string) {
    const addr = await this.prisma.storefrontAddress.findUnique({ where: { id } });
    if (!addr || addr.phone !== phone) throw new NotFoundException('Address not found');
    return addr;
  }

  async update(id: string, phone: string, dto: UpdateAddressDto) {
    await this.findOwned(id, phone);

    if (dto.isDefault) {
      await this.prisma.storefrontAddress.updateMany({
        where: { phone, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.storefrontAddress.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.line1 !== undefined && { line1: dto.line1 }),
        ...(dto.line2 !== undefined && { line2: dto.line2 }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.pincode !== undefined && { pincode: dto.pincode }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
    });
  }

  async setDefault(id: string, phone: string) {
    await this.findOwned(id, phone);
    await this.prisma.storefrontAddress.updateMany({
      where: { phone, isDefault: true },
      data: { isDefault: false },
    });
    return this.prisma.storefrontAddress.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  async remove(id: string, phone: string) {
    const addr = await this.findOwned(id, phone);
    await this.prisma.storefrontAddress.delete({ where: { id } });

    // If deleted address was default, promote the most recently created one
    if (addr.isDefault) {
      const next = await this.prisma.storefrontAddress.findFirst({
        where: { phone },
        orderBy: { createdAt: 'asc' },
      });
      if (next) {
        await this.prisma.storefrontAddress.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    return { success: true };
  }
}
