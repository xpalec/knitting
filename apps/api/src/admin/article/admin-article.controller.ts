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
import { AdminArticleService } from './admin-article.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { UpdateArticleBlocksDto } from './dto/update-article-blocks.dto';
import { UpsertArticleTranslationDto } from './dto/upsert-article-translation.dto';

@ApiTags('admin/articles')
@Controller('api/v1/admin/articles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('editor' as never)
export class AdminArticleController {
  constructor(private readonly adminArticleService: AdminArticleService) {}

  // ---------------------------------------------------------------------------
  // Article CRUD
  // ---------------------------------------------------------------------------

  @Get()
  @ApiOperation({ summary: 'List articles (admin — all statuses, paginated)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'q', required: false, description: 'Search by title (EN)' })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'review', 'published', 'deprecated'] })
  @ApiQuery({ name: 'locale', required: false, example: 'en' })
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('locale') locale = 'en',
  ) {
    return this.adminArticleService.findAll(
      parseInt(page, 10),
      parseInt(limit, 10),
      q,
      status,
      locale,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Single article with all translations and tags' })
  findOne(@Param('id') id: string) {
    return this.adminArticleService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create article (language-independent fields only)' })
  create(@Body() dto: CreateArticleDto) {
    return this.adminArticleService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update article (language-independent fields)' })
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.adminArticleService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin' as never)
  @ApiOperation({ summary: 'Delete article and all its translations' })
  delete(@Param('id') id: string) {
    return this.adminArticleService.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Content blocks layout
  // ---------------------------------------------------------------------------

  @Put(':id/blocks')
  @ApiOperation({ summary: 'Replace the content_blocks layout manifest for an article' })
  updateBlocks(@Param('id') id: string, @Body() dto: UpdateArticleBlocksDto) {
    return this.adminArticleService.updateBlocks(id, dto);
  }

  // ---------------------------------------------------------------------------
  // Translations
  // ---------------------------------------------------------------------------

  @Put(':id/translations/:locale')
  @ApiOperation({ summary: 'Create or update an ArticleTranslation (title, slug, blocks, SEO)' })
  upsertTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertArticleTranslationDto,
  ) {
    return this.adminArticleService.upsertTranslation(id, locale, dto);
  }

  // ---------------------------------------------------------------------------
  // Tags
  // ---------------------------------------------------------------------------

  @Put(':id/tags')
  @ApiOperation({ summary: 'Replace the tag set for an article' })
  setTags(
    @Param('id') id: string,
    @Body() body: { tag_ids: string[] },
  ) {
    return this.adminArticleService.setTags(id, body.tag_ids ?? []);
  }
}
