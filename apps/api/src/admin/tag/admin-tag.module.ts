import { Module } from '@nestjs/common';
import { AdminTagController } from './admin-tag.controller';
import { AdminTagService } from './admin-tag.service';

@Module({
  controllers: [AdminTagController],
  providers: [AdminTagService],
  exports: [AdminTagService],
})
export class AdminTagModule {}
