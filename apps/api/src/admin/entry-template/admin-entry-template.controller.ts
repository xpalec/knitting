import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminEntryTemplateService } from './admin-entry-template.service';
import { CreateEntryTemplateDto } from './dto/create-entry-template.dto';
import { UpdateEntryTemplateDto } from './dto/update-entry-template.dto';

@ApiTags('admin/entry-templates')
@Controller('api/v1/admin/entry-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin' as never)
export class AdminEntryTemplateController {
  constructor(private readonly service: AdminEntryTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'List all entry templates' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single entry template by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new entry template' })
  create(@Body() dto: CreateEntryTemplateDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an entry template' })
  update(@Param('id') id: string, @Body() dto: UpdateEntryTemplateDto) {
    return this.service.update(id, dto);
  }

  @Put(':id/translations/:locale')
  @ApiOperation({ summary: 'Upsert per-locale block translation defaults' })
  upsertTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() body: Record<string, Record<string, string>>,
  ) {
    return this.service.upsertTranslation(id, locale, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an entry template' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
