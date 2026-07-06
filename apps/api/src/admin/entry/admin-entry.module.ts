import { Module } from '@nestjs/common';
import { AdminEntryController } from './admin-entry.controller';
import { AdminEntryService } from './admin-entry.service';
import { MediaModule } from '../../media/media.module';

@Module({
  imports: [MediaModule],
  controllers: [AdminEntryController],
  providers: [AdminEntryService],
})
export class AdminEntryModule {}
