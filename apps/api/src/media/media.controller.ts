import {
  Controller,
  Param,
  Post,
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

@ApiTags('admin/media')
@Controller('api/v1/admin/media')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('editor' as never)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post(':entryId/upload')
  @ApiOperation({ summary: 'Upload media asset to R2 and link to entry' })
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
