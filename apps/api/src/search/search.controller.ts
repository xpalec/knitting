import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('api/v1/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Full-text search against Translation.search_vector' })
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }
}
