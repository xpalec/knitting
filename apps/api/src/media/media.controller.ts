import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MediaService } from './media.service';
import { UpdateAltTextDto } from './dto/update-alt-text.dto';

@ApiTags('admin/media')
@Controller('api/v1/admin/media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('editor' as never)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('image-upload')
  @ApiOperation({ summary: 'Upload an image for use in the rich text editor' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadEditorImage(@UploadedFile() file: Express.Multer.File) {
    return this.mediaService.uploadEditorImage(file);
  }

  @Post('entry/:entryId/upload')
  @ApiOperation({ summary: 'Upload media asset to R2 and link to entry' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadForEntry(
    @Param('entryId') entryId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.mediaService.uploadForEntity('entry', entryId, file);
  }

  @Post('article/:articleId/upload')
  @ApiOperation({ summary: 'Upload media asset to R2 and link to article' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadForArticle(
    @Param('articleId') articleId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.mediaService.uploadForEntity('article', articleId, file);
  }

  @Patch('assets/:assetId')
  @ApiOperation({ summary: 'Update alt text on a media asset' })
  async updateAltText(
    @Param('assetId') assetId: string,
    @Body() dto: UpdateAltTextDto,
  ) {
    const asset = await this.mediaService.updateAltText(assetId, dto.alt_text);
    return { data: asset };
  }

  @Get('assets')
  @ApiOperation({ summary: 'List media assets for an entity' })
  async listAssets(
    @Query('source_type') sourceType: 'entry' | 'article',
    @Query('source_id') sourceId: string,
  ) {
    const assets = await this.mediaService.listForEntity(sourceType, sourceId);
    return { data: assets };
  }

  @Post(':entryId/upload')
  @ApiOperation({
    summary: 'Upload media asset to R2 and link to entry (deprecated)',
    deprecated: true,
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  upload(
    @Param('entryId') entryId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.mediaService.upload(entryId, file);
  }
}
