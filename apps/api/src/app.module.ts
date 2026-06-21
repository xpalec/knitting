import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { createKeyv } from '@keyv/redis';
import { CacheableMemory } from 'cacheable';
import { Keyv } from 'keyv';

// Infrastructure
import { PrismaModule } from './prisma/prisma.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

// Auth
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

// Public modules
import { CategoryModule } from './category/category.module';
import { EntryModule } from './entry/entry.module';
import { TagModule } from './tag/tag.module';
import { SearchModule } from './search/search.module';
import { ArticleModule } from './article/article.module';
import { CountryModule } from './country/country.module';
import { LearnModule } from './learn/learn.module';
import { ContributionModule } from './contribution/contribution.module';

// Admin modules
import { AdminQueueModule } from './admin/queue/admin-queue.module';
import { AdminEntryModule } from './admin/entry/admin-entry.module';
import { AdminTagModule } from './admin/tag/admin-tag.module';
import { AdminCategoryModule } from './admin/category/admin-category.module';
import { AdminBlockTemplateModule } from './admin/block-template/admin-block-template.module';
import { AdminContentBlockTypeModule } from './admin/content-block-type/admin-content-block-type.module';
import { AdminEntryTemplateModule } from './admin/entry-template/admin-entry-template.module';
import { AdminStatsModule } from './admin/stats/admin-stats.module';
import { AdminArticleModule } from './admin/article/admin-article.module';
import { AdminAbbreviationModule } from './admin/abbreviation/admin-abbreviation.module';
import { AdminEntryRelationshipModule } from './admin/entry-relationship/admin-entry-relationship.module';
import { UserModule } from './user/user.module';
import { MediaModule } from './media/media.module';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

@Module({
  imports: [
    // Cache with Redis + in-memory fallback
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({
        stores: [
          new Keyv({ store: new CacheableMemory({ ttl: 60_000, lruSize: 5000 }) }),
          createKeyv(REDIS_URL),
        ],
      }),
    }),

    // Rate limiting
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 60 }],
    }),

    // Core
    PrismaModule,
    AuthModule,

    // Public
    CategoryModule,
    EntryModule,
    TagModule,
    SearchModule,
    ArticleModule,
    CountryModule,
    LearnModule,
    ContributionModule,

    // Admin
    AdminQueueModule,
    AdminEntryModule,
    AdminTagModule,
    AdminCategoryModule,
    AdminBlockTemplateModule,
    AdminContentBlockTypeModule,
    AdminEntryTemplateModule,
    AdminStatsModule,
    AdminArticleModule,
    AdminAbbreviationModule,
    AdminEntryRelationshipModule,
    UserModule,
    MediaModule,
  ],
  providers: [
    // Global exception filter for Prisma errors
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },

    // Global response transform
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },

    // Global JWT guard (routes opt-out with @Public())
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // Global roles guard
    { provide: APP_GUARD, useClass: RolesGuard },

    // Global throttler guard
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
