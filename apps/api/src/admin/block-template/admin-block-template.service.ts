import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminBlockTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const templates = await this.prisma.blockTemplate.findMany({
      orderBy: { entry_type: 'asc' },
    });
    return { data: templates };
  }

  async update(entryType: string, blocks: unknown[]) {
    const existing = await this.prisma.blockTemplate.findUnique({
      where: { entry_type: entryType },
    });
    if (!existing) {
      throw new NotFoundException(`BlockTemplate for entry_type '${entryType}' not found`);
    }

    const updated = await this.prisma.blockTemplate.update({
      where: { entry_type: entryType },
      data: { blocks: blocks as never },
    });
    return { data: updated };
  }
}
