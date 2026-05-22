import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          return (req?.cookies as Record<string, string>)?.['access_token'] ?? null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'changeme',
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload?.sub) {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
