import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CategoryService } from './category.service';

@ApiTags('categories')
@Controller('api/v1/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Full category tree (nested), locale-aware' })
  @ApiQuery({ name: 'locale', required: false, example: 'en' })
  async getTree(@Query('locale') locale = 'en') {
    const tree = await this.categoryService.getTree(locale);
    return { data: tree };
  }

  @Public()
  @Get(':slug/entries')
  @ApiOperation({
    summary:
      'Paginated entries in a category. Slug is locale-specific (resolved via CategoryTranslation).',
  })
  @ApiQuery({ name: 'locale', required: false, example: 'en' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async getEntries(
    @Param('slug') slug: string,
    @Query('locale') locale = 'en',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const result = await this.categoryService.getEntriesByCategory(
      slug,
      locale,
      Math.max(1, parseInt(page, 10)),
      Math.min(100, Math.max(1, parseInt(limit, 10))),
    );
    if (!result) {
      throw new NotFoundException(
        `Category with slug '${slug}' not found for locale '${locale}'`,
      );
    }
    return result;
  }
}
