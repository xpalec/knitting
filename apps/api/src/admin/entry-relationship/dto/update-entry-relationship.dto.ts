import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EntryRelationshipType } from '../../../generated/prisma';

export class UpdateEntryRelationshipDto {
  @ApiPropertyOptional({
    enum: EntryRelationshipType,
    description: 'Updated relationship type',
  })
  @IsOptional()
  @IsEnum(EntryRelationshipType)
  type?: EntryRelationshipType;

  @ApiPropertyOptional({
    example: 'Often used as a simpler alternative.',
    description: 'Updated note (send empty string to clear)',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
