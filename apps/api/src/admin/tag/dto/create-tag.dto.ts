import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateTagDto {
  @ApiProperty({
    example: 'fair-isle',
    description: 'Canonical English kebab-case slug — immutable once created',
  })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case (e.g. fair-isle)',
  })
  declare slug: string;

  @ApiPropertyOptional({
    enum: ['fiber_type', 'needle_type', 'garment_part', 'style_tradition'],
  })
  @IsOptional()
  @IsIn(['fiber_type', 'needle_type', 'garment_part', 'style_tradition'])
  type?: string;

  @ApiPropertyOptional({ example: '#228B22' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color_hex must be a valid hex colour (e.g. #228B22)' })
  color_hex?: string;

  // Seed the English translation inline for convenience
  @ApiProperty({ example: 'Fair Isle', description: 'English display name (seeds en TagTranslation)' })
  @IsString()
  @MaxLength(120)
  declare name_en: string;
}
