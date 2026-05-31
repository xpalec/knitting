import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EntryListQueryDto {
  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: 'lace' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'wool', description: 'Filter by tag slug (canonical English identifier)' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
  })
  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced', 'expert'])
  skillLevel?: string;

  @ApiPropertyOptional({ enum: ['alpha', 'skill'] })
  @IsOptional()
  @IsIn(['alpha', 'skill'])
  sort?: string;
}
