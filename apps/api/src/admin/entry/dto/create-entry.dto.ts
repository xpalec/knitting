import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateEntryDto {
  @ApiProperty({ example: 'uuid-of-entry-template', description: 'FK to EntryTemplate — seeds content_blocks' })
  @IsUUID()
  declare entry_template_id: string;

  @ApiProperty({ example: 'en' })
  @IsString()
  declare origin_language: string;

  @ApiProperty({ example: 'Stockinette stitch' })
  @IsString()
  declare term: string;

  @ApiPropertyOptional({ example: 'A basic knitting stitch pattern.' })
  @IsOptional()
  @IsString()
  definition_short?: string;
}
