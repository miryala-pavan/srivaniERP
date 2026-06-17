import {
  Controller, Get, Post, Patch,
  Body, Query, BadRequestException,
} from '@nestjs/common';
import { StorefrontProfileService } from './storefront-profile.service';

@Controller('storefront-profile')
export class StorefrontProfileController {
  constructor(private readonly service: StorefrontProfileService) {}

  @Get()
  async get(@Query('email') email?: string) {
    if (!email) throw new BadRequestException('email query param required');
    const profile = await this.service.findByEmail(email);
    if (!profile) return null;
    return profile;
  }

  @Post()
  upsert(
    @Body('email')          email:          string,
    @Body('name')           name:           string,
    @Body('phone')          phone?:         string,
    @Body('alternatePhone') alternatePhone?: string,
    @Body('photoUrl')       photoUrl?:      string,
  ) {
    if (!email) throw new BadRequestException('email required');
    if (!name)  throw new BadRequestException('name required');
    return this.service.upsert({ email, name, phone, alternatePhone, photoUrl });
  }

  @Patch()
  update(
    @Query('email')         email:          string,
    @Body('name')           name?:          string,
    @Body('phone')          phone?:         string,
    @Body('alternatePhone') alternatePhone?: string,
  ) {
    if (!email) throw new BadRequestException('email query param required');
    return this.service.update(email, { name, phone, alternatePhone });
  }
}
