import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AdminBlockTemplateService } from './admin-block-template.service';

@ApiTags('admin/settings')
@Controller('api/v1/admin/settings/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin' as never)
export class AdminBlockTemplateController {
  constructor(private readonly service: AdminBlockTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'List all BlockTemplate rows' })
  findAll() {
    return this.service.findAll();
  }

  @Put(':entry_type')
  @ApiOperation({ summary: 'Update default blocks for an entry type (admin only)' })
  update(
    @Param('entry_type') entryType: string,
    @Body() body: { blocks: unknown[] },
  ) {
    return this.service.update(entryType, body.blocks);
  }
}
