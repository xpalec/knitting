import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class AssignEntryTagsDto {
  @ApiProperty({
    example: ['uuid-1', 'uuid-2'],
    description: 'Complete set of tag IDs to assign to the entry. Replaces the current set.',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  declare ids: string[];
}
