import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { ContributionService } from './contribution.service';
import { CorrectionDto } from './dto/correction.dto';
import { EntrySubmissionDto } from './dto/entry-submission.dto';
import { TranslationSubmissionDto } from './dto/translation-submission.dto';

@ApiTags('contributions')
@Controller('api/v1/contributions')
export class ContributionController {
  constructor(private readonly contributionService: ContributionService) {}

  @Public()
  @Post('entry')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'Submit a new entry suggestion (5/IP/hour)' })
  submitEntry(@Body() dto: EntrySubmissionDto) {
    return this.contributionService.submitEntry(dto);
  }

  @Public()
  @Post('translation')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 3600000 } })
  @ApiOperation({ summary: 'Submit a translation (20/IP/hour)' })
  submitTranslation(@Body() dto: TranslationSubmissionDto) {
    return this.contributionService.submitTranslation(dto);
  }

  @Public()
  @Post('correction')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 3600000 } })
  @ApiOperation({ summary: 'Submit a correction report (10/IP/hour)' })
  submitCorrection(@Body() dto: CorrectionDto) {
    return this.contributionService.submitCorrection(dto);
  }
}
