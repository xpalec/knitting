import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTranslationDto {
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
