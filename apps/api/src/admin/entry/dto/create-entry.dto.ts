import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateEntryDto {
  @ApiProperty({ example: 'stitch', description: 'Entry type — seeds BlockTemplate' })
  @IsString()
  declare entry_type: string;

  @ApiProperty({ example: 'en' })
  @IsString()
  declare origin_language: string;

  @ApiPropertyOptional({ enum: ['beginner', 'intermediate', 'advanced', 'expert'] })
  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced', 'expert'])
  skill_level?: string;

  @ApiProperty({ example: 'Stockinette stitch' })
  @IsString()
  declare term: string;

  @ApiPropertyOptional({ example: 'A basic knitting stitch pattern.' })
  @IsOptional()
  @IsString()
  definition_short?: string;
}
