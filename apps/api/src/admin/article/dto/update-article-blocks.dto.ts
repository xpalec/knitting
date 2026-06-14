import { ApiProperty } from '@nestjs/swagger';
import { IsArray } from 'class-validator';

export class UpdateArticleBlocksDto {
  @ApiProperty({
    description:
      'Full ordered ContentBlock[] layout manifest. ' +
      'Each item: { id: uuid, type: string, label?: string, order: number, visible: boolean, required: boolean }',
    type: 'array',
  })
  @IsArray()
  declare blocks: unknown[];
}
