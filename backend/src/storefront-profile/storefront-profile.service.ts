import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  /**
   * Full email-ownership verification is a separate follow-up (wiring the
   * storefront's NextAuth/Google session into the backend) — out of scope
   * here. What this DOES close: once a profile has a phone on file, only
   * the matching OTP-verified phone can read or touch it, which is the
   * actual exploitable surface (phone/address/data exposure) closed by
   * this pass. A profile with no phone yet has no verified secret to check
   * against.
   */
  private assertOwnsPhone(profilePhone: string | null, verifiedPhone: string) {
    if (profilePhone && profilePhone !== verifiedPhone) {
      throw new NotFoundException('Profile not found');
    }
  }

  async findByEmail(email: string, verifiedPhone: string) {
    const profile = await this.prisma.storefrontProfile.findUnique({ where: { email } });
    if (!profile) return null;
    this.assertOwnsPhone(profile.phone, verifiedPhone);
    return profile;
  }

  async upsert(dto: UpsertProfileDto, verifiedPhone: string) {
    if (dto.phone !== undefined && dto.phone !== '' && dto.phone !== verifiedPhone) {
      throw new ForbiddenException('Phone must match your verified number');
    }
    const existing = await this.prisma.storefrontProfile.findUnique({ where: { email: dto.email } });
    if (existing) this.assertOwnsPhone(existing.phone, verifiedPhone);

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

  async update(email: string, dto: UpdateProfileDto, verifiedPhone: string) {
    const existing = await this.prisma.storefrontProfile.findUnique({ where: { email } });
    if (!existing) throw new NotFoundException('Profile not found');
    this.assertOwnsPhone(existing.phone, verifiedPhone);
    if (dto.phone !== undefined && dto.phone !== '' && dto.phone !== verifiedPhone) {
      throw new ForbiddenException('Phone must match your verified number');
    }

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
