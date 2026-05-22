import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class PatchStatusDto {
  @ApiProperty({ enum: ['draft', 'review', 'published', 'deprecated'] })
  @IsIn(['draft', 'review', 'published', 'deprecated'])
  declare status: string;
}
