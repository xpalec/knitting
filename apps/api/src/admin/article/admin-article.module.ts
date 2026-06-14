import { Module } from '@nestjs/common';
import { AdminArticleController } from './admin-article.controller';
import { AdminArticleService } from './admin-article.service';

@Module({
  controllers: [AdminArticleController],
  providers: [AdminArticleService],
  exports: [AdminArticleService],
})
export class AdminArticleModule {}
