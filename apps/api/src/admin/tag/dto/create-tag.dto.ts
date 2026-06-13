import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateTagDto {
  @ApiProperty({ example: 'Fair Isle', description: 'English display name (seeds en TagTranslation)' })
  @IsString()
  @MaxLength(120)
  declare name_en: string;

  @ApiPropertyOptional({
    example: 'fair-isle',
    description: 'English locale slug for the en TagTranslation (auto-derived from name_en if omitted)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug_en must be lowercase kebab-case',
  })
  slug_en?: string;
}
