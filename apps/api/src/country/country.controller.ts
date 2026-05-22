import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CountryService } from './country.service';

@ApiTags('countries')
@Controller('api/v1/countries')
export class CountryController {
  constructor(private readonly countryService: CountryService) {}

  @Public()
  @Get(':code')
  @ApiOperation({ summary: 'Country landing data — featured entries and articles' })
  @ApiQuery({ name: 'locale', required: false, example: 'en' })
  findOne(
    @Param('code') code: string,
    @Query('locale') locale = 'en',
  ) {
    return this.countryService.findByCode(code, locale);
  }
}
