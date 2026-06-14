import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateArticleDto {
  @ApiPropertyOptional({
    description: 'Category UUID (type = article). Pass null to remove category.',
    example: 'a1b2c3d4-...',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  category_id?: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover.jpg', nullable: true })
  @IsOptional()
  @IsString()
  cover_image_url?: string | null;

  @ApiPropertyOptional({ example: 'Jane Doe', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  author?: string | null;

  @ApiPropertyOptional({ example: 'pl', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  country_code?: string | null;

  @ApiPropertyOptional({ enum: ['draft', 'review', 'published', 'deprecated'] })
  @IsOptional()
  @IsIn(['draft', 'review', 'published', 'deprecated'])
  status?: string;
}
