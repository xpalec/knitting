import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { LearnService } from './learn.service';

@ApiTags('learn')
@Controller('api/v1/learn')
export class LearnController {
  constructor(private readonly learnService: LearnService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List of learning paths with metadata' })
  findAll() {
    return this.learnService.findAll();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Learning path detail with ordered entries' })
  @ApiQuery({ name: 'locale', required: false, example: 'en' })
  findOne(
    @Param('slug') slug: string,
    @Query('locale') locale = 'en',
  ) {
    return this.learnService.findBySlug(slug, locale);
  }
}
