import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertArticleTranslationDto {
  @ApiProperty({ example: 'Getting Started with Fair Isle Knitting' })
  @IsString()
  @MaxLength(255)
  declare title: string;

  @ApiProperty({ example: 'getting-started-fair-isle', description: 'Locale-specific URL slug' })
  @IsString()
  @MaxLength(100)
  declare slug: string;

  @ApiPropertyOptional({
    description: 'Plain-text one-line summary shown in cards and previews.',
    example: 'An introduction to Fair Isle colour-work techniques.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  short_description?: string;

  @ApiPropertyOptional({
    description:
      'Per-block translated content keyed by block id. ' +
      'Shape: { [blockId]: { heading?: string; content?: TipTap JSON } }',
  })
  @IsOptional()
  blocks?: Record<string, { heading?: string; content?: unknown }>;

  @ApiPropertyOptional({
    description: 'Locale-specific <title> override for the article page (≤60 chars).',
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  seo_title?: string;

  @ApiPropertyOptional({
    description: 'Locale-specific meta description for the article page (≤160 chars).',
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  seo_description?: string;

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
