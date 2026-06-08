import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AdminEntryService } from './admin-entry.service';
import { CreateEntryDto } from './dto/create-entry.dto';
import { PatchStatusDto } from './dto/patch-status.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { UpsertTranslationDto } from './dto/upsert-translation.dto';

@ApiTags('admin/entries')
@Controller('api/v1/admin/entries')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('editor' as never)
export class AdminEntryController {
  constructor(private readonly adminEntryService: AdminEntryService) {}

  @Post()
  @ApiOperation({ summary: 'Create entry (seeds content_blocks from BlockTemplate)' })
  create(@Body() dto: CreateEntryDto) {
    return this.adminEntryService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Searchable, filterable list of all entries' })
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('q') q?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('category_id') categoryId?: string,
    @Query('status') status?: string,
  ) {
    return this.adminEntryService.findAll(
      parseInt(page, 10),
      parseInt(limit, 10),
      q ?? search,
      type,
      categoryId,
      status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Full entry detail for admin editor' })
  findOne(@Param('id') id: string) {
    return this.adminEntryService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update Entry fields (origin_language, status, metadata)' })
  update(@Param('id') id: string, @Body() dto: UpdateEntryDto) {
    return this.adminEntryService.update(id, dto);
  }

  @Put(':id/blocks')
  @Roles('admin' as never)
  @ApiOperation({ summary: 'Update content_blocks layout (admin only)' })
  updateBlocks(@Param('id') id: string, @Body() body: { blocks: unknown[] }) {
    return this.adminEntryService.updateBlocks(id, body.blocks);
  }

  @Put(':id/translations/:locale')
  @ApiOperation({ summary: 'Create or update a Translation row' })
  upsertTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertTranslationDto,
  ) {
    return this.adminEntryService.upsertTranslation(id, locale, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Status transitions: draft→review→published; deprecate' })
  patchStatus(@Param('id') id: string, @Body() dto: PatchStatusDto) {
    return this.adminEntryService.patchStatus(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete: sets Entry.status = deprecated' })
  softDelete(@Param('id') id: string) {
    return this.adminEntryService.softDelete(id);
  }
}
