import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { EntryListQueryDto } from './dto/entry-list-query.dto';
import { EntryService } from './entry.service';

@ApiTags('entries')
@Controller('api/v1/entries')
export class EntryController {
  constructor(private readonly entryService: EntryService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Paginated, locale-aware alphabetical entry list' })
  findAll(@Query() query: EntryListQueryDto) {
    return this.entryService.findAll(query);
  }

  @Public()
  @Get(':locale/:slug')
  @ApiOperation({ summary: 'Full entry detail resolved via (locale, slug)' })
  findOne(@Param('locale') locale: string, @Param('slug') slug: string) {
    return this.entryService.findBySlug(locale, slug);
  }
}
