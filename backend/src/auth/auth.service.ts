import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async onModuleInit() {
    await this.seedTestUser();
  }

  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null },
      include: {
        business: { select: { id: true, name: true, gstin: true, stateName: true } },
      },
    });
    if (!user || user.status !== 'ACTIVE') return null;

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) return null;

    const { passwordHash, pin, ...result } = user;
    return result;
  }

  async validateUserByPin(username: string, pinInput: string) {
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null },
      include: {
        business: { select: { id: true, name: true, gstin: true, stateName: true } },
      },
    });
    if (!user || user.status !== 'ACTIVE') return null;
    if (!user.pin) return null;

    const valid = await argon2.verify(user.pin, pinInput);
    if (!valid) return null;

    const { passwordHash, pin, ...result } = user;
    return result;
  }

  async login(user: any) {
    const payload = {
      sub:        user.id,
      username:   user.username,
      role:       user.role,
      businessId: user.businessId,
      counterId:  user.counterId ?? null,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id:         user.id,
        username:   user.username,
        fullName:   user.fullName,
        role:       user.role,
        businessId: user.businessId,
        counterId:  user.counterId ?? null,
        business:   user.business,
      },
    };
  }

  async register(dto: RegisterDto) {
    const businessCount = await this.prisma.business.count();
    if (businessCount > 0) {
      throw new ForbiddenException('Business already registered. Please login.');
    }

    const business = await this.prisma.business.create({
      data: { name: dto.businessName, gstin: dto.gstin },
    });

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const user = await this.prisma.user.create({
      data: {
        businessId: business.id,
        username:   dto.username,
        passwordHash,
        fullName:   dto.fullName,
        email:      dto.email,
        phone:      dto.phone,
        role:       'SUPER_ADMIN',
        status:     'ACTIVE',
      },
    });

    const payload = {
      sub:        user.id,
      username:   user.username,
      role:       user.role,
      businessId: user.businessId,
      counterId:  null,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id:         user.id,
        username:   user.username,
        fullName:   user.fullName,
        role:       user.role,
        businessId: user.businessId,
        counterId:  null,
      },
    };
  }

  async verifyPin(userId: string, pin: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pin: true, passwordHash: true },
    });
    if (!user) return false;
    if (user.pin) return argon2.verify(user.pin, pin);
    return argon2.verify(user.passwordHash, pin);
  }

  async refreshToken(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE', deletedAt: null },
      include: {
        business: { select: { id: true, name: true, gstin: true, stateName: true } },
      },
    });
    if (!user) throw new UnauthorizedException('User not found or inactive');

    const payload = {
      sub:        user.id,
      username:   user.username,
      role:       user.role,
      businessId: user.businessId,
      counterId:  user.counterId ?? null,
    };

    const newToken = this.jwtService.sign(payload, {
      expiresIn: (process.env.JWT_EXPIRES_IN || '12h') as any,
    });

    return {
      access_token: newToken,
      user: {
        id:         user.id,
        username:   user.username,
        fullName:   user.fullName,
        role:       user.role,
        businessId: user.businessId,
        counterId:  user.counterId ?? null,
        business:   user.business,
      },
    };
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id:         true,
        username:   true,
        fullName:   true,
        email:      true,
        phone:      true,
        role:       true,
        status:     true,
        businessId: true,
        counterId:  true,
        lastLoginAt: true,
        createdAt:  true,
        business: {
          select: { id: true, name: true, gstin: true, stateName: true, stateCode: true },
        },
      },
    });
  }

  private async seedTestUser() {
    const userCount = await this.prisma.user.count();
    if (userCount > 0) return;

    let business = await this.prisma.business.findFirst();
    if (!business) {
      business = await this.prisma.business.create({
        data: { name: 'Srivani Stores', stateCode: '36', stateName: 'Telangana' },
      });
    }

    const passwordHash = await argon2.hash('Admin@2026', { type: argon2.argon2id });
    await this.prisma.user.create({
      data: {
        businessId:   business.id,
        username:     'admin',
        passwordHash,
        fullName:     'Srivani Admin',
        role:         'SUPER_ADMIN',
        status:       'ACTIVE',
      },
    });
    console.log('Test user seeded: admin / Admin@2026');
  }
}
