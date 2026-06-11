import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TemplateBlockItemDto } from './template-block-item.dto';

export class CreateEntryTemplateDto {
  @ApiProperty({ example: 'Technique – Step-by-Step Guide', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  declare name: string;

  @ApiPropertyOptional({ example: 'A reusable template for technique entries.', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    type: () => [TemplateBlockItemDto],
    description: 'Ordered block list. Defaults to empty array if omitted.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateBlockItemDto)
  blocks?: TemplateBlockItemDto[];

  @ApiPropertyOptional({
    description: 'Translation defaults: { [blockId]: { [locale]: { [fieldName]: string } } }',
    example: { 'uuid-1': { en: { heading: 'Introduction' }, pl: { heading: 'Wstęp' } } },
  })
  @IsOptional()
  @IsObject()
  translations?: Record<string, Record<string, Record<string, string>>>;
}
