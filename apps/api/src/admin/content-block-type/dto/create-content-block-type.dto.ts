import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateContentBlockTypeDto {
  @ApiProperty({
    example: 'rich_text',
    description:
      'Machine-readable slug. Must start with a lowercase letter followed by lowercase letters, digits, or underscores.',
    pattern: '^[a-z][a-z0-9_]*$',
  })
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message:
      'type must start with a lowercase letter followed only by lowercase letters, digits, or underscores',
  })
  declare type: string;

  @ApiProperty({ example: 'Rich Text', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  declare label: string;

  @ApiPropertyOptional({ example: 'A freeform rich-text block.', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: '#EDE7FF', description: 'Accent color hex from the shared palette' })
  @IsOptional()
  @IsString()
  @MaxLength(9)
  color?: string;
}
