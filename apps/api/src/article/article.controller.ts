import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ArticleService } from './article.service';

@ApiTags('articles')
@Controller('api/v1/articles')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List articles with optional tag and country filter' })
  @ApiQuery({ name: 'locale', required: false, example: 'en' })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'country', required: false })
  findAll(
    @Query('locale') locale = 'en',
    @Query('tag') tag?: string,
    @Query('country') country?: string,
  ) {
    return this.articleService.findAll(locale, tag, country);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Full article detail' })
  @ApiQuery({ name: 'locale', required: false, example: 'en' })
  findOne(
    @Param('slug') slug: string,
    @Query('locale') locale = 'en',
  ) {
    return this.articleService.findBySlug(slug, locale);
  }
}
