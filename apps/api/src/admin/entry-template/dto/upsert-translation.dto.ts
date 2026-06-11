import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * Body for PUT /api/v1/admin/entry-templates/:id/translations/:locale
 * Shape: { [blockId]: { [fieldName]: string } }
 * Example: { "uuid-1": { "heading": "Introduction" }, "uuid-2": { "heading": "Steps" } }
 */
export class UpsertTranslationDto {
  @ApiProperty({
    description: 'Map of blockId → fieldName → value for the given locale',
    example: { 'uuid-1': { heading: 'Introduction' }, 'uuid-2': { heading: 'Steps' } },
  })
  @IsObject()
  declare blockTranslations: Record<string, Record<string, string>>;
}
