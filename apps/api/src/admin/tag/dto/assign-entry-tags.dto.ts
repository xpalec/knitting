import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class AssignEntryTagsDto {
  @ApiProperty({
    example: ['wool', 'fair-isle'],
    description: 'Complete set of tag slugs to assign to the entry. Replaces the current set.',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  declare slugs: string[];
}
