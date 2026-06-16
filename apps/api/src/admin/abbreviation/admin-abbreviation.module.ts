import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAbbreviationController } from './admin-abbreviation.controller';
import { AdminAbbreviationService } from './admin-abbreviation.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminAbbreviationController],
  providers: [AdminAbbreviationService],
  exports: [AdminAbbreviationService],
})
export class AdminAbbreviationModule {}
