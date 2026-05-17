import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Request, UseGuards,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private svc: DepartmentsService) {}

  @Get()
  findAll(@Request() req: any, @Query('isActive') isActive?: string) {
    return this.svc.findAll(req.user.businessId, isActive);
  }

  @Post()
  create(@Request() req: any, @Body() body: { name: string; code: string; sortOrder?: number }) {
    return this.svc.create(req.user.businessId, body);
  }

  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; sortOrder?: number; isActive?: boolean },
  ) {
    return this.svc.update(req.user.businessId, id, body);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.svc.remove(req.user.businessId, id);
  }

  @Get(':id/categories')
  getCategories(@Request() req: any, @Param('id') id: string) {
    return this.svc.getCategories(req.user.businessId, id);
  }
}
