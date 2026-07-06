import { Module } from '@nestjs/common';
import { AdminArticleController } from './admin-article.controller';
import { AdminArticleService } from './admin-article.service';
import { MediaModule } from '../../media/media.module';

@Module({
  imports: [MediaModule],
  controllers: [AdminArticleController],
  providers: [AdminArticleService],
  exports: [AdminArticleService],
})
export class AdminArticleModule {}
