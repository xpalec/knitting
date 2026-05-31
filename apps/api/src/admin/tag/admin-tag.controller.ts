import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminTagService } from './admin-tag.service';
import { AssignEntryTagsDto } from './dto/assign-entry-tags.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { UpsertTagTranslationDto } from './dto/upsert-tag-translation.dto';

@ApiTags('admin/tags')
@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('editor' as never)
export class AdminTagController {
  constructor(private readonly adminTagService: AdminTagService) {}

  // ---------------------------------------------------------------------------
  // Tag CRUD
  // ---------------------------------------------------------------------------

  @Get('tags')
  @ApiOperation({ summary: 'List all tags (admin view — all locales, all statuses)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search?: string,
  ) {
    return this.adminTagService.findAll(
      parseInt(page, 10),
      parseInt(limit, 10),
      search,
    );
  }

  @Get('tags/:slug')
  @ApiOperation({ summary: 'Single tag detail with all translations' })
  findOne(@Param('slug') slug: string) {
    return this.adminTagService.findOne(slug);
  }

  @Post('tags')
  @ApiOperation({ summary: 'Create tag and seed its English translation' })
  create(@Body() dto: CreateTagDto) {
    return this.adminTagService.create(dto);
  }

  @Put('tags/:slug')
  @ApiOperation({ summary: 'Update tag type and/or color_hex' })
  update(@Param('slug') slug: string, @Body() dto: UpdateTagDto) {
    return this.adminTagService.update(slug, dto);
  }

  @Delete('tags/:slug')
  @Roles('admin' as never)
  @ApiOperation({
    summary: 'Delete tag — blocked if any entries are assigned',
  })
  delete(@Param('slug') slug: string) {
    return this.adminTagService.delete(slug);
  }

  // ---------------------------------------------------------------------------
  // TagTranslation
  // ---------------------------------------------------------------------------

  @Put('tags/:slug/translations/:locale')
  @ApiOperation({ summary: 'Create or update a TagTranslation (name, description, SEO fields)' })
  upsertTranslation(
    @Param('slug') slug: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertTagTranslationDto,
  ) {
    return this.adminTagService.upsertTranslation(slug, locale, dto);
  }

  // ---------------------------------------------------------------------------
  // Entry tag assignment
  // ---------------------------------------------------------------------------

  @Post('entries/:id/tags')
  @ApiOperation({
    summary: 'Assign tags to an entry — replaces the current set',
  })
  assignEntryTags(
    @Param('id') id: string,
    @Body() dto: AssignEntryTagsDto,
  ) {
    return this.adminTagService.assignEntryTags(id, dto.slugs);
  }
}
