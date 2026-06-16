import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class LinkEntryAbbreviationDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'UUID of the abbreviation to link' })
  @IsUUID()
  declare abbreviation_id: string;

  @ApiPropertyOptional({ example: false, description: 'Whether this is the primary abbreviation for this entry', default: false })
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @ApiPropertyOptional({ example: 0, description: 'Display order within the entry\'s abbreviation list (0–9999)', minimum: 0, maximum: 9999, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sort_order?: number;
}
