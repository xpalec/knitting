import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class TemplateBlockItemDto {
  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Stable UUID for this block slot. Generated server-side if omitted.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'rich_text', description: 'Block_Type_Slug referencing a ContentBlockType' })
  @IsString()
  @MinLength(1)
  declare type: string;

  @ApiProperty({ example: 1, description: '1-based position in the template block list' })
  @IsInt()
  @Min(1)
  declare order: number;

  @ApiProperty({ example: false, description: 'Whether this block is mandatory in entries of this type' })
  @IsBoolean()
  declare required: boolean;
}
