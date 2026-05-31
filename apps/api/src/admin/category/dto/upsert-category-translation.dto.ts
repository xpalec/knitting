import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertCategoryTranslationDto {
  @ApiProperty({ example: 'Stitches' })
  @IsString()
  @MaxLength(120)
  declare name: string;

  @ApiProperty({ example: 'stitches', description: 'Locale-specific URL slug' })
  @IsString()
  @MaxLength(120)
  declare slug: string;

  @ApiPropertyOptional({
    description: 'TipTap JSON — editorial introduction to the category. Nullable.',
  })
  @IsOptional()
  description?: unknown;

  @ApiPropertyOptional({ example: 'Translated by Jane.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  translator_note?: string;

  @ApiPropertyOptional({ enum: ['draft', 'reviewed', 'published'] })
  @IsOptional()
  @IsIn(['draft', 'reviewed', 'published'])
  status?: string;
}
