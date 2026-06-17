import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertProfileDto {
  email: string;
  name: string;
  phone?: string;
  alternatePhone?: string;
  photoUrl?: string;
}

export interface UpdateProfileDto {
  name?: string;
  phone?: string;
  alternatePhone?: string;
}

@Injectable()
export class StorefrontProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.storefrontProfile.findUnique({ where: { email } });
  }

  async upsert(dto: UpsertProfileDto) {
    return this.prisma.storefrontProfile.upsert({
      where: { email: dto.email },
      create: {
        email:          dto.email,
        name:           dto.name,
        phone:          dto.phone          ?? null,
        alternatePhone: dto.alternatePhone ?? null,
        photoUrl:       dto.photoUrl       ?? null,
      },
      update: {
        name:           dto.name,
        ...(dto.phone          !== undefined ? { phone:          dto.phone }          : {}),
        ...(dto.alternatePhone !== undefined ? { alternatePhone: dto.alternatePhone } : {}),
        ...(dto.photoUrl       !== undefined ? { photoUrl:       dto.photoUrl }       : {}),
      },
    });
  }

  async update(email: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.storefrontProfile.findUnique({ where: { email } });
    if (!existing) throw new NotFoundException('Profile not found');
    return this.prisma.storefrontProfile.update({
      where: { email },
      data: {
        ...(dto.name           !== undefined ? { name:           dto.name }           : {}),
        ...(dto.phone          !== undefined ? { phone:          dto.phone || null }   : {}),
        ...(dto.alternatePhone !== undefined ? { alternatePhone: dto.alternatePhone || null } : {}),
      },
    });
  }
}
