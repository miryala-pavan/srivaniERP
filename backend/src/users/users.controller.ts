import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, ResetPinDto } from './dto/update-user.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get()
  findAll(@Request() req: any) {
    return this.usersService.findAll(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('counters')
  getCounters(@Request() req: any) {
    return this.usersService.getCounters(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.usersService.findOne(id, req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post()
  create(@Body() dto: CreateUserDto, @Request() req: any) {
    return this.usersService.create(req.user.businessId, dto, {
      id:       req.user.userId,
      fullName: req.user.username,
    });
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req: any) {
    return this.usersService.update(id, req.user.businessId, dto, {
      id:       req.user.userId,
      fullName: req.user.username,
    });
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Put(':id/reset-pin')
  resetPin(@Param('id') id: string, @Body() dto: ResetPinDto, @Request() req: any) {
    return this.usersService.resetPin(id, req.user.businessId, dto, {
      id:       req.user.userId,
      fullName: req.user.username,
    });
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Put(':id/toggle-active')
  toggleActive(@Param('id') id: string, @Request() req: any) {
    return this.usersService.toggleActive(id, req.user.businessId, req.user.userId);
  }
}
