import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ enum: ['entry', 'abbreviation', 'article'] })
  @IsOptional()
  @IsIn(['entry', 'abbreviation', 'article'])
  type?: string;

  @ApiPropertyOptional({
    description: 'Move to a different parent. Pass null to promote to top-level.',
    example: 'a1b2c3d4-...',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  parent_id?: string | null;

  @ApiPropertyOptional({ example: 'technique' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  icon?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @ApiPropertyOptional({ enum: ['draft', 'published'] })
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover.jpg', nullable: true })
  @IsOptional()
  @IsString()
  cover_image_url?: string | null;
}
