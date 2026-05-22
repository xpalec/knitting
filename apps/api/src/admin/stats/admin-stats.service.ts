import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DashboardStats {
  publishedEntries: number;
  pendingQueueItems: number;
  enCoverage: number;  // percentage 0–100
  plCoverage: number;  // percentage 0–100
}

@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<DashboardStats> {
    const [
      publishedEntries,
      pendingQueueItems,
      totalEntries,
      enCount,
      plCount,
    ] = await Promise.all([
      this.prisma.entry.count({ where: { status: 'published' } }),
      this.prisma.contribution.count({ where: { status: 'pending' } }),
      this.prisma.entry.count(),
      this.prisma.translation.count({ where: { locale: 'en' } }),
      this.prisma.translation.count({ where: { locale: 'pl' } }),
    ]);

    const enCoverage =
      totalEntries > 0 ? Math.round((enCount / totalEntries) * 100) : 0;
    const plCoverage =
      totalEntries > 0 ? Math.round((plCount / totalEntries) * 100) : 0;

    return { publishedEntries, pendingQueueItems, enCoverage, plCoverage };
  }
}
