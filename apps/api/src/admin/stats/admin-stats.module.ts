import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminStatsController],
  providers: [AdminStatsService],
})
export class AdminStatsModule {}
