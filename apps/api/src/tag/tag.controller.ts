import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { TagService } from './tag.service';

@ApiTags('tags')
@Controller('api/v1/tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary:
      'List all published tags with translated name, description, and SEO fields',
  })
  @ApiQuery({ name: 'locale', required: false, example: 'en' })
  async findAll(@Query('locale') locale = 'en') {
    const tags = await this.tagService.findAll(locale);
    return { data: tags };
  }
}
