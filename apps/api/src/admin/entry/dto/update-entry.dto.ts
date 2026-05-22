import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateEntryDto {
  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  origin_language?: string;

  @ApiPropertyOptional({ enum: ['draft', 'review', 'published', 'deprecated'] })
  @IsOptional()
  @IsIn(['draft', 'review', 'published', 'deprecated'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
