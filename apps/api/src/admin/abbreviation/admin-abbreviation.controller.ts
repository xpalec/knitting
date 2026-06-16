import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAbbreviationService } from './admin-abbreviation.service';
import { CreateAbbreviationDto } from './dto/create-abbreviation.dto';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { LinkEntryAbbreviationDto } from './dto/link-entry-abbreviation.dto';
import { ListAbbreviationsQueryDto } from './dto/list-abbreviations-query.dto';
import { UpdateAbbreviationDto } from './dto/update-abbreviation.dto';
import { UpdateEntryAbbreviationDto } from './dto/update-entry-abbreviation.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';

@ApiTags('admin/abbreviations')
@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('editor' as never)
export class AdminAbbreviationController {
  constructor(private readonly adminAbbreviationService: AdminAbbreviationService) {}

  // ---------------------------------------------------------------------------
  // Abbreviation CRUD
  // ---------------------------------------------------------------------------

  @Get('abbreviations')
  @ApiOperation({ summary: 'Paginated list of abbreviations with optional filters' })
  findAll(@Query() query: ListAbbreviationsQueryDto) {
    return this.adminAbbreviationService.findAll(query);
  }

  @Get('abbreviations/:id')
  @ApiOperation({ summary: 'Single abbreviation with translations and entry links' })
  findOne(@Param('id') id: string) {
    return this.adminAbbreviationService.findOne(id);
  }

  @Post('abbreviations')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new abbreviation' })
  create(@Body() dto: CreateAbbreviationDto) {
    return this.adminAbbreviationService.create(dto);
  }

  @Patch('abbreviations/:id')
  @ApiOperation({ summary: 'Update abbreviation code and/or source language' })
  update(@Param('id') id: string, @Body() dto: UpdateAbbreviationDto) {
    return this.adminAbbreviationService.update(id, dto);
  }

  @Delete('abbreviations/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Permanently delete an abbreviation and all its translations/links' })
  delete(@Param('id') id: string) {
    return this.adminAbbreviationService.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Translation CRUD
  // ---------------------------------------------------------------------------

  @Post('abbreviations/:id/translations')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a translation for a specific locale' })
  createTranslation(
    @Param('id') id: string,
    @Body() dto: CreateTranslationDto,
  ) {
    return this.adminAbbreviationService.createTranslation(id, dto);
  }

  @Patch('abbreviations/:id/translations/:locale')
  @ApiOperation({ summary: 'Update an existing translation' })
  updateTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() dto: UpdateTranslationDto,
  ) {
    return this.adminAbbreviationService.updateTranslation(id, locale, dto);
  }

  @Delete('abbreviations/:id/translations/:locale')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a translation for a specific locale' })
  deleteTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
  ) {
    return this.adminAbbreviationService.deleteTranslation(id, locale);
  }

  // ---------------------------------------------------------------------------
  // Entry–Abbreviation Link CRUD
  // ---------------------------------------------------------------------------

  @Post('entries/:entryId/abbreviations')
  @HttpCode(201)
  @ApiOperation({ summary: 'Link an abbreviation to an entry' })
  linkEntry(
    @Param('entryId') entryId: string,
    @Body() dto: LinkEntryAbbreviationDto,
  ) {
    return this.adminAbbreviationService.linkEntry(entryId, dto);
  }

  @Patch('entries/:entryId/abbreviations/:abbreviationId')
  @ApiOperation({ summary: 'Update join record metadata (is_primary, sort_order)' })
  updateLink(
    @Param('entryId') entryId: string,
    @Param('abbreviationId') abbreviationId: string,
    @Body() dto: UpdateEntryAbbreviationDto,
  ) {
    return this.adminAbbreviationService.updateLink(entryId, abbreviationId, dto);
  }

  @Delete('entries/:entryId/abbreviations/:abbreviationId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Unlink an abbreviation from an entry' })
  unlinkEntry(
    @Param('entryId') entryId: string,
    @Param('abbreviationId') abbreviationId: string,
  ) {
    return this.adminAbbreviationService.unlinkEntry(entryId, abbreviationId);
  }
}
