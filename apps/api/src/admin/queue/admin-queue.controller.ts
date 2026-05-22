import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AdminQueueService } from './admin-queue.service';
import { ReviewContributionDto } from './dto/review-contribution.dto';

@ApiTags('admin/queue')
@Controller('api/v1/admin/queue')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('editor' as never)
export class AdminQueueController {
  constructor(private readonly adminQueueService: AdminQueueService) {}

  @Get('entries')
  @ApiOperation({ summary: 'Pending entry submissions' })
  listEntries(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminQueueService.listEntryQueue(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Patch('entries/:id')
  @ApiOperation({ summary: 'Approve or reject an entry submission' })
  reviewEntry(
    @Param('id') id: string,
    @Body() dto: ReviewContributionDto,
  ) {
    return this.adminQueueService.reviewEntry(id, dto);
  }

  @Get('translations')
  @ApiOperation({ summary: 'Pending translation submissions' })
  listTranslations(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminQueueService.listTranslationQueue(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Patch('translations/:id')
  @ApiOperation({ summary: 'Approve or reject a translation submission' })
  reviewTranslation(
    @Param('id') id: string,
    @Body() dto: ReviewContributionDto,
  ) {
    return this.adminQueueService.reviewTranslation(id, dto);
  }

  @Get('corrections')
  @ApiOperation({ summary: 'Pending correction reports' })
  listCorrections(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminQueueService.listCorrectionQueue(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Patch('corrections/:id')
  @ApiOperation({ summary: 'Acknowledge or dismiss a correction' })
  reviewCorrection(
    @Param('id') id: string,
    @Body() dto: ReviewContributionDto,
  ) {
    return this.adminQueueService.reviewCorrection(id, dto);
  }
}
