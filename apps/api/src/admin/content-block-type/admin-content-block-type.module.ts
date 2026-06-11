import { Module } from '@nestjs/common';
import { AdminContentBlockTypeController } from './admin-content-block-type.controller';
import { AdminContentBlockTypeService } from './admin-content-block-type.service';

@Module({
  controllers: [AdminContentBlockTypeController],
  providers: [AdminContentBlockTypeService],
})
export class AdminContentBlockTypeModule {}
