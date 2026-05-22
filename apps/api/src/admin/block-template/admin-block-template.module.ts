import { Module } from '@nestjs/common';
import { AdminBlockTemplateController } from './admin-block-template.controller';
import { AdminBlockTemplateService } from './admin-block-template.service';

@Module({
  controllers: [AdminBlockTemplateController],
  providers: [AdminBlockTemplateService],
})
export class AdminBlockTemplateModule {}
