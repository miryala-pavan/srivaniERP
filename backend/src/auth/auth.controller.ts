import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    let user: any;
    if (dto.pin) {
      user = await this.authService.validateUserByPin(dto.username, dto.pin);
    } else if (dto.password) {
      user = await this.authService.validateUser(dto.username, dto.password);
    } else {
      throw new UnauthorizedException('Provide either password or PIN');
    }
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return this.authService.login(user);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-pin')
  async verifyPin(@Body() body: { pin: string }, @Request() req: any) {
    const valid = await this.authService.verifyPin(req.user.userId, body.pin);
    if (!valid) throw new UnauthorizedException('Invalid PIN');
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  async refresh(@Request() req: any) {
    return this.authService.refreshToken(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.userId);
  }
}
