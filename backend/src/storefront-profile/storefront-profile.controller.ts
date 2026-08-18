import {
  Controller, Get, Post, Patch,
  Body, Query, UseGuards, Request, BadRequestException,
} from '@nestjs/common';
import { StorefrontProfileService } from './storefront-profile.service';
import { StorefrontJwtGuard } from '../storefront-auth/guards/storefront-jwt.guard';

@Controller('storefront-profile')
@UseGuards(StorefrontJwtGuard)
export class StorefrontProfileController {
  constructor(private readonly service: StorefrontProfileService) {}

  @Get()
  async get(@Query('email') email: string | undefined, @Request() req: any) {
    if (!email) throw new BadRequestException('email query param required');
    const profile = await this.service.findByEmail(email, req.verifiedPhone);
    if (!profile) return null;
    return profile;
  }

  @Post()
  upsert(
    @Body('email')          email:          string,
    @Body('name')           name:           string,
    @Body('phone')          phone:          string | undefined,
    @Body('alternatePhone') alternatePhone: string | undefined,
    @Body('photoUrl')       photoUrl:       string | undefined,
    @Request() req: any,
  ) {
    if (!email) throw new BadRequestException('email required');
    if (!name)  throw new BadRequestException('name required');
    return this.service.upsert({ email, name, phone, alternatePhone, photoUrl }, req.verifiedPhone);
  }

  @Patch()
  update(
    @Query('email')         email:          string,
    @Body('name')           name:           string | undefined,
    @Body('phone')          phone:          string | undefined,
    @Body('alternatePhone') alternatePhone: string | undefined,
    @Request() req: any,
  ) {
    if (!email) throw new BadRequestException('email query param required');
    return this.service.update(email, { name, phone, alternatePhone }, req.verifiedPhone);
  }
}
