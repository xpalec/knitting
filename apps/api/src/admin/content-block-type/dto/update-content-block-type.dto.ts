import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateContentBlockTypeDto {
  @ApiPropertyOptional({ example: 'Rich Text', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @ApiPropertyOptional({ example: 'A freeform rich-text block.', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: '#EDE7FF', description: 'Accent color hex' })
  @IsOptional()
  @IsString()
  @MaxLength(9)
  color?: string;
}
