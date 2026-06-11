import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminContentBlockTypeService } from './admin-content-block-type.service';
import { CreateContentBlockTypeDto } from './dto/create-content-block-type.dto';
import { UpdateContentBlockTypeDto } from './dto/update-content-block-type.dto';
import { UpsertContentBlockTypeTranslationDto } from './dto/upsert-content-block-type-translation.dto';

@ApiTags('admin/content-block-types')
@Controller('api/v1/admin/content-block-types')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin' as never)
export class AdminContentBlockTypeController {
  constructor(private readonly service: AdminContentBlockTypeService) {}

  @Get()
  @ApiOperation({ summary: 'List all registered content block types' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single content block type with its translations' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Register a new content block type' })
  create(@Body() dto: CreateContentBlockTypeDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update label, description, or color of a content block type' })
  update(@Param('id') id: string, @Body() dto: UpdateContentBlockTypeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a content block type' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Put(':id/translations/:locale')
  @ApiOperation({ summary: 'Create or update a translation (heading) for a locale' })
  upsertTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertContentBlockTypeTranslationDto,
  ) {
    return this.service.upsertTranslation(id, locale, dto);
  }
}
