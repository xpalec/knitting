import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTranslationDto {
  @ApiProperty({ example: 'en', description: 'BCP-47 locale code for this translation' })
  @IsString()
  @IsNotEmpty()
  declare locale: string;

  @ApiPropertyOptional({
    example: 'knit 2 together',
    description: 'Plain-text short meaning (max 500 chars)',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  short_meaning?: string | null;

  @ApiPropertyOptional({
    description: 'Tiptap JSON describing the abbreviation in detail. Nullable.',
    nullable: true,
  })
  @IsOptional()
  description?: unknown | null;
}
