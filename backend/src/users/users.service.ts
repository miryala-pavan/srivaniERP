import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, ResetPinDto } from './dto/update-user.dto';
import { AuditLogService } from '../audit-log/audit-log.service';

const USER_SELECT = {
  id:           true,
  username:     true,
  fullName:     true,
  email:        true,
  phone:        true,
  role:         true,
  status:       true,
  counterId:    true,
  lastLoginAt:  true,
  createdAt:    true,
  createdByName: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private auditLog: AuditLogService) {}

  async findAll(businessId: string) {
    const users = await this.prisma.user.findMany({
      where:   { businessId, deletedAt: null },
      select:  USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });

    // Attach counter names
    const counterIds = [...new Set(users.map(u => u.counterId).filter(Boolean))] as string[];
    let counterMap: Record<string, string> = {};
    if (counterIds.length) {
      const counters = await this.prisma.posCounter.findMany({
        where:  { id: { in: counterIds } },
        select: { id: true, name: true, code: true },
      });
      counterMap = Object.fromEntries(counters.map(c => [c.id, `${c.name} (${c.code})`]));
    }

    return users.map(u => ({
      ...u,
      counterName: u.counterId ? (counterMap[u.counterId] ?? null) : null,
      isActive: u.status === 'ACTIVE',
    }));
  }

  async findOne(id: string, businessId: string) {
    const user = await this.prisma.user.findFirst({
      where:  { id, businessId, deletedAt: null },
      select: { ...USER_SELECT, assignedCounterIds: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return { ...user, isActive: user.status === 'ACTIVE' };
  }

  async create(businessId: string, dto: CreateUserDto, createdBy: { id: string; fullName: string }) {
    const existing = await this.prisma.user.findFirst({
      where: { businessId, username: dto.username },
    });
    if (existing) throw new ConflictException('Username already taken in this business');

    const pinHash      = await argon2.hash(dto.pin, { type: argon2.argon2id });
    const unusableHash = await argon2.hash(`NO_PWD_${dto.username}_${Date.now()}`, { type: argon2.argon2id });

    const user = await this.prisma.user.create({
      data: {
        businessId,
        username:      dto.username,
        fullName:      dto.fullName,
        email:         dto.email,
        phone:         dto.phone,
        role:          dto.role as any,
        counterId:     dto.counterId,
        pin:           pinHash,
        passwordHash:  unusableHash,
        status:        'ACTIVE',
        createdById:   createdBy.id,
        createdByName: createdBy.fullName,
      },
      select: USER_SELECT,
    });

    this.auditLog.log(
      { userId: createdBy.id, userName: createdBy.fullName, userRole: 'BRANCH_MANAGER', businessId },
      { action: 'CREATE', entity: 'USER', entityId: user.id, entityRef: user.username, description: `User created: ${user.fullName} (${user.username}) — role ${dto.role}` },
    ).catch(() => {});

    return { ...user, isActive: true };
  }

  async update(
    id: string,
    businessId: string,
    dto: UpdateUserDto,
    updatedBy: { id: string; fullName: string },
  ) {
    const user = await this.findOne(id, businessId);

    // Manager cannot change a SUPER_ADMIN
    if (user.role === 'SUPER_ADMIN' && updatedBy.id !== id) {
      throw new ForbiddenException('Cannot modify the owner account');
    }

    const updated = await this.prisma.user.update({
      where:  { id },
      data: {
        ...(dto.fullName   !== undefined && { fullName:  dto.fullName }),
        ...(dto.role       !== undefined && { role:      dto.role as any }),
        ...(dto.phone      !== undefined && { phone:     dto.phone }),
        ...(dto.email      !== undefined && { email:     dto.email }),
        ...(dto.counterId  !== undefined && { counterId: dto.counterId }),
        updatedById:   updatedBy.id,
        updatedByName: updatedBy.fullName,
      },
      select: USER_SELECT,
    });

    return { ...updated, isActive: updated.status === 'ACTIVE' };
  }

  async resetPin(id: string, businessId: string, dto: ResetPinDto, resetBy: { id: string; fullName: string }) {
    await this.findOne(id, businessId);

    const pinHash = await argon2.hash(dto.newPin, { type: argon2.argon2id });

    await this.prisma.user.update({
      where: { id },
      data: {
        pin:           pinHash,
        updatedById:   resetBy.id,
        updatedByName: resetBy.fullName,
      },
    });

    return { success: true, message: 'PIN reset successfully' };
  }

  async toggleActive(id: string, businessId: string, requesterId: string) {
    if (id === requesterId) {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    const user = await this.findOne(id, businessId);

    if (user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot deactivate the owner account');
    }

    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    await this.prisma.user.update({
      where: { id },
      data:  { status: newStatus as any },
    });

    this.auditLog.log(
      { userId: requesterId, userName: 'Manager', userRole: 'BRANCH_MANAGER', businessId },
      { action: 'STATUS_CHANGE', entity: 'USER', entityId: id, entityRef: user.username, description: `User ${user.fullName} (${user.username}) ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}` },
    ).catch(() => {});

    return { isActive: newStatus === 'ACTIVE', status: newStatus };
  }

  async getCounters(businessId: string) {
    return this.prisma.posCounter.findMany({
      where:   { businessId, status: 'ACTIVE' },
      select:  { id: true, name: true, code: true, description: true },
      orderBy: { code: 'asc' },
    });
  }
}
