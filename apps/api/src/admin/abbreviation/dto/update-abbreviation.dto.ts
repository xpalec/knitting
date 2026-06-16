import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAbbreviationDto {
  @ApiPropertyOptional({ example: 'K2tog', description: 'The abbreviation as it appears in knitting patterns', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  code?: string;

  @ApiPropertyOptional({ example: 'en', description: 'BCP-47 locale of the knitting tradition this abbreviation originates from' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  source_language?: string;
}
