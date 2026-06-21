import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { EntryRelationshipType } from '../../../generated/prisma';

export class CreateEntryRelationshipDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'UUID of the source entry',
  })
  @IsUUID()
  declare sourceEntryId: string;

  @ApiProperty({
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    description: 'UUID of the target entry',
  })
  @IsUUID()
  declare targetEntryId: string;

  @ApiProperty({
    enum: EntryRelationshipType,
    example: EntryRelationshipType.RELATED_TO,
    description: 'The type of relationship between the two entries',
  })
  @IsEnum(EntryRelationshipType)
  declare type: EntryRelationshipType;

  @ApiPropertyOptional({
    example: 'Often used as a simpler alternative in beginner patterns.',
    description: 'Optional note providing context for this relationship',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
