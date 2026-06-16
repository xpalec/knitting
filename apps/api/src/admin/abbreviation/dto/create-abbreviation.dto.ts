import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateAbbreviationDto {
  @ApiProperty({ example: 'K2tog', description: 'The abbreviation as it appears in knitting patterns', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  declare code: string;

  @ApiProperty({ example: 'en', description: 'BCP-47 locale of the knitting tradition this abbreviation originates from' })
  @IsString()
  @IsNotEmpty()
  declare source_language: string;
}
