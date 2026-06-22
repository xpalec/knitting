import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

const COOKIE_NAME = 'access_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: '/',
};

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive JWT in HttpOnly cookie' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const { accessToken } = await this.authService.login(dto);
    const maxAge = this.parseDuration(process.env.JWT_EXPIRY ?? '7d');
    res.cookie(COOKIE_NAME, accessToken, { ...COOKIE_OPTIONS, maxAge });
    return { message: 'Logged in' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear the auth cookie' })
  logout(@Res({ passthrough: true }) res: Response): { message: string } {
    res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
    return { message: 'Logged out' };
  }

  @Get('me')
  @ApiOperation({ summary: 'Return the current authenticated user from JWT' })
  me(@Req() req: Request & { user: JwtPayload }): { id: string; email: string; role: string } {
    return { id: req.user.sub, email: req.user.email, role: req.user.role };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reissue access token using the existing valid cookie' })
  async refresh(
    @Req() req: Request & { user: JwtPayload },
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const { accessToken } = await this.authService.refresh(req.user);
    const maxAge = this.parseDuration(process.env.JWT_EXPIRY ?? '7d');
    res.cookie(COOKIE_NAME, accessToken, { ...COOKIE_OPTIONS, maxAge });
    return { message: 'Token refreshed' };
  }

  /** Convert e.g. "7d" → milliseconds */
  private parseDuration(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const n = parseInt(match[1]!, 10);
    const unit = match[2]!;
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return n * (multipliers[unit] ?? 86_400_000);
  }
}
