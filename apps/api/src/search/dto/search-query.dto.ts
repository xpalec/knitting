import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SearchQueryDto {
  @ApiPropertyOptional({ example: 'stockinette' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ example: 'lace' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
  })
  @IsOptional()
  @IsString()
  skillLevel?: string;
}
