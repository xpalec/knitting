import { Module } from '@nestjs/common';
import { AdminEntryRelationshipController } from './admin-entry-relationship.controller';
import { AdminEntryRelationshipService } from './admin-entry-relationship.service';

@Module({
  controllers: [AdminEntryRelationshipController],
  providers: [AdminEntryRelationshipService],
})
export class AdminEntryRelationshipModule {}
