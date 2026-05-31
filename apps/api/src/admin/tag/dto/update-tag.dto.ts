import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateTagDto {
  @ApiPropertyOptional({
    enum: ['fiber_type', 'needle_type', 'garment_part', 'style_tradition'],
  })
  @IsOptional()
  @IsIn(['fiber_type', 'needle_type', 'garment_part', 'style_tradition'])
  type?: string;

  @ApiPropertyOptional({ example: '#228B22' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color_hex must be a valid hex colour (e.g. #228B22)' })
  color_hex?: string;
}
