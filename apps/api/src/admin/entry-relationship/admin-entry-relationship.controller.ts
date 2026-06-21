import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AdminEntryRelationshipService } from './admin-entry-relationship.service';
import { CreateEntryRelationshipDto } from './dto/create-entry-relationship.dto';
import { UpdateEntryRelationshipDto } from './dto/update-entry-relationship.dto';

@ApiTags('admin/entry-relationships')
@Controller('api/v1/admin/entry-relationships')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('editor' as never)
export class AdminEntryRelationshipController {
  constructor(
    private readonly adminEntryRelationshipService: AdminEntryRelationshipService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List relationships for a source entry' })
  async listRelationships(@Query('sourceEntryId') sourceEntryId: string) {
    const data =
      await this.adminEntryRelationshipService.listRelationships(sourceEntryId);
    return { data };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new entry relationship' })
  createRelationship(@Body() dto: CreateEntryRelationshipDto) {
    return this.adminEntryRelationshipService.createRelationship(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update relationship type and/or note' })
  updateRelationship(
    @Param('id') id: string,
    @Body() dto: UpdateEntryRelationshipDto,
  ) {
    return this.adminEntryRelationshipService.updateRelationship(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an entry relationship by ID' })
  deleteRelationship(@Param('id') id: string) {
    return this.adminEntryRelationshipService.deleteRelationship(id);
  }
}