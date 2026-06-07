import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ enum: ['entry', 'abbreviation', 'article'] })
  @IsIn(['entry', 'abbreviation', 'article'])
  declare type: string;

  @ApiPropertyOptional({
    description: 'Parent category UUID. Omit or pass null for top-level categories.',
    example: 'a1b2c3d4-...',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  parent_id?: string | null;

  @ApiPropertyOptional({ example: 'stitch', description: 'Icon key or SVG path — locale-independent' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  icon?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sort_order?: number;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/stitches.jpg', nullable: true })
  @IsOptional()
  @IsString()
  cover_image_url?: string | null;

  @ApiPropertyOptional({ enum: ['draft', 'published'], default: 'draft' })
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: string;

  @ApiPropertyOptional({
    example: '#a78bfa',
    description: 'Accent color hex. Randomly assigned if omitted.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(9)
  color?: string;
}
