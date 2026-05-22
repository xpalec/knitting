import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewContributionDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  declare action: 'approve' | 'reject';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewer_note?: string;
}
