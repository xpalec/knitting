import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ListAbbreviationsQueryDto {
  @ApiPropertyOptional({ example: 'K2tog', description: 'Search string for abbreviation code (1–100 characters)', minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ example: 'en', description: 'Filter by source language (BCP-47 locale)' })
  @IsOptional()
  @IsString()
  source_language?: string;

  @ApiPropertyOptional({ example: 'pl', description: 'Locale for resolving translation short_meaning via fallback chain' })
  @IsOptional()
  @IsString()
  display_language?: string;

  @ApiPropertyOptional({ example: 1, description: 'Page number (1-based)', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Number of results per page (1–100)', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
