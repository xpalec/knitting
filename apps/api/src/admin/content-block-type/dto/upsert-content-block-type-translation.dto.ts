import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpsertContentBlockTypeTranslationDto {
  @ApiProperty({
    example: 'Rich Text',
    description: 'Translated heading shown to readers as the section title for this block.',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  declare heading: string;
}
