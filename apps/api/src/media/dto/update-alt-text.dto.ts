import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAltTextDto {
  @ApiPropertyOptional({
    description:
      'Accessibility alt text for the image (0–500 characters). Pass null to clear. Omit to preserve the existing value.',
    maxLength: 500,
    nullable: true,
    example: 'A close-up of a cable-knit sweater in merino wool.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  alt_text?: string | null;
}
