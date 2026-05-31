import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ enum: ['entry', 'abbreviation', 'article'] })
  @IsIn(['entry', 'abbreviation', 'article'])
  declare type: string;

  @ApiPropertyOptional({
    description: 'Parent category UUID. Omit for top-level categories.',
    example: 'a1b2c3d4-...',
  })
  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @ApiPropertyOptional({ example: 'stitch', description: 'Icon key or SVG path — locale-independent' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  icon?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  sort_order?: number;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/stitches.jpg' })
  @IsOptional()
  @IsString()
  cover_image_url?: string;

  // Seed the English translation inline for convenience
  @ApiProperty({
    example: 'Stitches',
    description: 'English display name — seeds the en CategoryTranslation',
  })
  @IsString()
  @MaxLength(120)
  declare name_en: string;

  @ApiProperty({
    example: 'stitches',
    description: 'English URL slug — seeds the en CategoryTranslation',
  })
  @IsString()
  @MaxLength(120)
  declare slug_en: string;
}
