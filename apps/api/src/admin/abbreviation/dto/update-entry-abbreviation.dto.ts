import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateEntryAbbreviationDto {
  @ApiPropertyOptional({ example: true, description: 'Whether this is the primary abbreviation for this entry' })
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @ApiPropertyOptional({ example: 1, description: 'Display order within the entry\'s abbreviation list (0–9999)', minimum: 0, maximum: 9999 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sort_order?: number;
}
