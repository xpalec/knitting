import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertTagTranslationDto {
  @ApiProperty({ example: 'Fair Isle' })
  @IsString()
  @MaxLength(120)
  declare name: string;

  @ApiPropertyOptional({
    description: 'TipTap JSON — editorial description shown on the public tag page',
  })
  @IsOptional()
  description?: unknown;

  @ApiPropertyOptional({
    example: 'Fair Isle Knitting — European Knitting Encyclopedia',
    description: 'SEO <title> override (≤60 chars). Falls back to name if absent.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  seo_title?: string;

  @ApiPropertyOptional({
    example: 'Explore Fair Isle knitting terms, techniques, and traditions.',
    description: 'Meta description for the tag page (≤160 chars).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  seo_description?: string;

  @ApiPropertyOptional({ enum: ['draft', 'reviewed', 'published'] })
  @IsOptional()
  @IsIn(['draft', 'reviewed', 'published'])
  status?: string;
}
