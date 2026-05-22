import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CorrectionDto {
  @ApiProperty({ example: 'stockinette-stitch' })
  @IsString()
  declare entry_slug: string;

  @ApiProperty({ example: 'en' })
  @IsString()
  declare locale: string;

  @ApiProperty({ example: 'term' })
  @IsString()
  declare field: string;

  @ApiProperty({ example: 'Stockinette stitch' })
  @IsString()
  @MaxLength(500)
  declare current_value: string;

  @ApiProperty({ example: 'Stocking stitch' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  declare suggested_value: string;

  @ApiPropertyOptional({ example: 'British English uses "stocking stitch"' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ example: 'contributor@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
