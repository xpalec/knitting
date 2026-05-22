import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, created_at: true },
      orderBy: { created_at: 'desc' },
    });
    return { data: users };
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const password_hash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role as never,
        password_hash,
      },
      select: { id: true, email: true, name: true, role: true, created_at: true },
    });
    return { data: user };
  }

  async updateRole(id: string, dto: UpdateUserRoleDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`User ${id} not found`);

    const user = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role as never },
      select: { id: true, email: true, name: true, role: true },
    });
    return { data: user };
  }
}
