import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class EntrySubmissionDto {
  @ApiProperty({ example: 'Stockinette stitch' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  declare term: string;

  @ApiProperty({ example: 'A basic knitting stitch pattern.' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  declare definition: string;

  @ApiPropertyOptional({ example: 'lace' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: ['beginner', 'intermediate', 'advanced', 'expert'] })
  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced', 'expert'])
  skill_level?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  origin_language?: string;

  @ApiPropertyOptional({ example: 'SS' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  abbreviation?: string;

  @ApiPropertyOptional({ example: 'contributor@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
