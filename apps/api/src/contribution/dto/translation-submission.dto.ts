import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class TranslationSubmissionDto {
  @ApiProperty({ example: 'stockinette-stitch', description: 'Slug of the existing entry (en locale)' })
  @IsString()
  declare entry_slug: string;

  @ApiProperty({ example: 'pl' })
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  declare locale: string;

  @ApiProperty({ example: 'Ścieg jersey' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  declare term: string;

  @ApiProperty({ example: 'Podstawowy ścieg dziewiarski.' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  declare definition: string;

  @ApiPropertyOptional({ example: 'SJ' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  abbreviation?: string;

  @ApiPropertyOptional({ example: 'contributor@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
