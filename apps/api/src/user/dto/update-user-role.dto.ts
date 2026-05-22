import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ['editor', 'reviewer', 'admin'] })
  @IsIn(['editor', 'reviewer', 'admin'])
  declare role: string;
}
