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
    description: 'Plain-text one-line summary — shown in cards and previews.',
    example: 'A brief overview of stitching techniques.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  short_description?: string;

  @ApiPropertyOptional({
    description: 'TipTap JSON — editorial introduction to the category. Nullable.',
  })
  @IsOptional()
  description?: unknown;

  @ApiPropertyOptional({
    description: 'Locale-specific <title> override for the category page (≤60 chars).',
    example: 'Stitches — Knitting Encyclopedia',
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  seo_title?: string;

  @ApiPropertyOptional({
    description: 'Locale-specific meta description for the category page (≤160 chars).',
    example: 'Browse all knitting stitch types with definitions and examples.',
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
