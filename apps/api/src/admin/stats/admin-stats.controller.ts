import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminStatsService } from './admin-stats.service';

@ApiTags('admin/stats')
@Controller('api/v1/admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('editor' as never)
export class AdminStatsController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  @Get()
  @ApiOperation({ summary: 'Aggregate dashboard stats' })
  getStats() {
    return this.adminStatsService.getStats();
  }
}
