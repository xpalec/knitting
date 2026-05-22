import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertTranslationDto {
  @ApiProperty({ example: 'Stockinette stitch' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  declare term: string;

  @ApiPropertyOptional({ example: 'stockinette-stitch' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  blocks?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['draft', 'reviewed', 'published'] })
  @IsOptional()
  @IsIn(['draft', 'reviewed', 'published'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  translator_note?: string;
}
