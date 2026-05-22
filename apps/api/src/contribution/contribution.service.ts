import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CorrectionDto } from './dto/correction.dto';
import { EntrySubmissionDto } from './dto/entry-submission.dto';
import { TranslationSubmissionDto } from './dto/translation-submission.dto';

@Injectable()
export class ContributionService {
  constructor(private readonly prisma: PrismaService) {}

  async submitEntry(dto: EntrySubmissionDto) {
    const contribution = await this.prisma.contribution.create({
      data: {
        type: 'entry',
        status: 'pending',
        payload: { ...dto },
        submitter_email: dto.email ?? null,
      },
    });
    return { data: { id: contribution.id, status: contribution.status } };
  }

  async submitTranslation(dto: TranslationSubmissionDto) {
    // Resolve entry_id from slug — never accept raw entry_id from public
    const translation = await this.prisma.translation.findFirst({
      where: { slug: dto.entry_slug, locale: 'en' },
      select: { entry_id: true },
    });

    if (!translation) {
      throw new BadRequestException(
        `No entry found with slug '${dto.entry_slug}'`,
      );
    }

    const contribution = await this.prisma.contribution.create({
      data: {
        type: 'translation',
        status: 'pending',
        payload: { ...dto },
        entry_id: translation.entry_id,
        submitter_email: dto.email ?? null,
      },
    });
    return { data: { id: contribution.id, status: contribution.status } };
  }

  async submitCorrection(dto: CorrectionDto) {
    // Resolve entry_id from slug
    const translation = await this.prisma.translation.findFirst({
      where: { slug: dto.entry_slug, locale: dto.locale },
      select: { entry_id: true },
    });

    if (!translation) {
      throw new BadRequestException(
        `No entry found with slug '${dto.entry_slug}' in locale '${dto.locale}'`,
      );
    }

    const contribution = await this.prisma.contribution.create({
      data: {
        type: 'correction',
        status: 'pending',
        payload: { ...dto },
        entry_id: translation.entry_id,
        submitter_email: dto.email ?? null,
      },
    });
    return { data: { id: contribution.id, status: contribution.status } };
  }
}
