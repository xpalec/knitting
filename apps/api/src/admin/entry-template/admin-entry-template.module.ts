import { Module } from '@nestjs/common';
import { AdminEntryTemplateController } from './admin-entry-template.controller';
import { AdminEntryTemplateService } from './admin-entry-template.service';

@Module({
  controllers: [AdminEntryTemplateController],
  providers: [AdminEntryTemplateService],
})
export class AdminEntryTemplateModule {}
