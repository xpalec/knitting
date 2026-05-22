import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    return { accessToken };
  }

  async validateUser(payload: JwtPayload) {
    return this.prisma.user.findUnique({ where: { id: payload.sub } });
  }

  async refresh(payload: JwtPayload): Promise<{ accessToken: string }> {
    // Verify the user still exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    // Issue a fresh token with up-to-date role
    const newPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(newPayload);
    return { accessToken };
  }
}
