import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class AssignEntryCategoriesDto {
  @ApiProperty({
    example: ['uuid-1', 'uuid-2'],
    description: 'Complete set of category UUIDs to assign to the entry. Replaces the current set.',
    type: [String],
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  declare categoryIds: string[];
}
