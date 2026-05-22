import { Module } from '@nestjs/common';
import { AdminEntryController } from './admin-entry.controller';
import { AdminEntryService } from './admin-entry.service';

@Module({
  controllers: [AdminEntryController],
  providers: [AdminEntryService],
})
export class AdminEntryModule {}
