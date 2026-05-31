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
import { AdminCategoryService } from './admin-category.service';
import { AssignEntryCategoriesDto } from './dto/assign-entry-categories.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpsertCategoryTranslationDto } from './dto/upsert-category-translation.dto';

@ApiTags('admin/categories')
@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('editor' as never)
export class AdminCategoryController {
  constructor(private readonly adminCategoryService: AdminCategoryService) {}

  // ---------------------------------------------------------------------------
  // Category CRUD
  // ---------------------------------------------------------------------------

  @Get('categories')
  @ApiOperation({ summary: 'List all categories (admin view — all statuses, all locales)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'search', required: false, description: 'Filter by English name' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by category type', enum: ['entry', 'abbreviation', 'article'] })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by category status', enum: ['draft', 'published'] })
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.adminCategoryService.findAll(
      parseInt(page, 10),
      parseInt(limit, 10),
      search,
      type,
      status,
    );
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Single category detail with all translations and direct children' })
  findOne(@Param('id') id: string) {
    return this.adminCategoryService.findOne(id);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create category and seed its English translation' })
  create(@Body() dto: CreateCategoryDto) {
    return this.adminCategoryService.create(dto);
  }

  @Put('categories/:id')
  @ApiOperation({ summary: 'Update category fields (parent, icon, sort_order, status, cover_image_url)' })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.adminCategoryService.update(id, dto);
  }

  @Delete('categories/:id')
  @Roles('admin' as never)
  @ApiOperation({
    summary: 'Delete category — blocked if it has assigned entries or child categories',
  })
  delete(@Param('id') id: string) {
    return this.adminCategoryService.delete(id);
  }

  // ---------------------------------------------------------------------------
  // CategoryTranslation
  // ---------------------------------------------------------------------------

  @Put('categories/:id/translations/:locale')
  @ApiOperation({ summary: 'Create or update a CategoryTranslation (name, slug, description)' })
  upsertTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertCategoryTranslationDto,
  ) {
    return this.adminCategoryService.upsertTranslation(id, locale, dto);
  }

  // ---------------------------------------------------------------------------
  // Entry category assignment
  // ---------------------------------------------------------------------------

  @Post('entries/:id/categories')
  @ApiOperation({
    summary: 'Assign categories to an entry — replaces the current set',
  })
  assignEntryCategories(
    @Param('id') id: string,
    @Body() dto: AssignEntryCategoriesDto,
  ) {
    return this.adminCategoryService.assignEntryCategories(id, dto.categoryIds);
  }
}
