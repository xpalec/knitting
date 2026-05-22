import { Module } from '@nestjs/common';
import { AdminQueueController } from './admin-queue.controller';
import { AdminQueueService } from './admin-queue.service';

@Module({
  controllers: [AdminQueueController],
  providers: [AdminQueueService],
})
export class AdminQueueModule {}
