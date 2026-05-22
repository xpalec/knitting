import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { EntryService } from './entry.service.js';

// Mock PrismaService to avoid loading the generated Prisma client (which uses import.meta)
jest.mock('../prisma/prisma.service.js', () => ({
  PrismaService: jest.fn(),
}));

import { PrismaService } from '../prisma/prisma.service.js';

const mockPrisma = {
  entry: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  translation: {
    findUnique: jest.fn(),
  },
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('EntryService', () => {
  let service: EntryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = module.get<EntryService>(EntryService);
  });

  describe('findAll', () => {
    it('returns paginated entries with locale-aware data', async () => {
      mockPrisma.entry.findMany.mockResolvedValue([
        {
          origin_language: 'en',
          status: 'published',
          metadata: { skill_level: 'beginner' },
          translations: [{ term: 'Knit stitch', slug: 'knit-stitch', metadata: { abbreviation: 'K' }, status: 'published' }],
          categories: [],
        },
      ]);
      mockPrisma.entry.count.mockResolvedValue(1);

      const result = await service.findAll({ locale: 'en', page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.term).toBe('Knit stitch');
      expect(result.data[0]?.abbreviation).toBe('K');
      expect(result.meta.total).toBe(1);
    });

    it('flags entries missing the requested locale translation', async () => {
      mockPrisma.entry.findMany.mockResolvedValue([
        {
          origin_language: 'pl',
          status: 'published',
          metadata: {},
          translations: [],
          categories: [],
        },
      ]);
      mockPrisma.entry.count.mockResolvedValue(1);

      const result = await service.findAll({ locale: 'de' });

      expect(result.data[0]?.missing_translation).toBe(true);
      expect(result.data[0]?.term).toBeNull();
    });

    it('sorts results alphabetically by locale', async () => {
      mockPrisma.entry.findMany.mockResolvedValue([
        {
          origin_language: 'en',
          status: 'published',
          metadata: {},
          translations: [{ term: 'Zebra stitch', slug: 'zebra', metadata: {}, status: 'published' }],
          categories: [],
        },
        {
          origin_language: 'en',
          status: 'published',
          metadata: {},
          translations: [{ term: 'Alpaca stitch', slug: 'alpaca', metadata: {}, status: 'published' }],
          categories: [],
        },
      ]);
      mockPrisma.entry.count.mockResolvedValue(2);

      const result = await service.findAll({ locale: 'en', sort: 'alpha' });

      expect(result.data[0]?.term).toBe('Alpaca stitch');
      expect(result.data[1]?.term).toBe('Zebra stitch');
    });
  });

  describe('findBySlug', () => {
    it('returns cached entry when available', async () => {
      const cached = { data: { term: 'Knit stitch', slug: 'knit-stitch' } };
      mockCache.get.mockResolvedValue(cached);

      const result = await service.findBySlug('en', 'knit-stitch');

      expect(result).toEqual(cached);
      expect(mockPrisma.translation.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when translation not found', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.translation.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('en', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns full entry detail without exposing Entry.id', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.translation.findUnique.mockResolvedValue({
        term: 'Knit stitch',
        slug: 'knit-stitch',
        locale: 'en',
        metadata: { definition_short: 'Basic knit stitch' },
        blocks: {},
        translator_note: null,
        status: 'published',
        entry: {
          id: 'secret-id',
          origin_language: 'en',
          status: 'published',
          metadata: { skill_level: 'beginner' },
          content_blocks: [],
          translations: [{ locale: 'en', slug: 'knit-stitch', term: 'Knit stitch' }],
          media_assets: [],
          pattern_usage: [],
          categories: [],
          related_from: [],
        },
      });

      const result = await service.findBySlug('en', 'knit-stitch') as { data: Record<string, unknown> };

      expect(result.data).not.toHaveProperty('id');
      expect(result.data['term']).toBe('Knit stitch');
      expect(result.data['definition_short']).toBe('Basic knit stitch');
    });
  });
});
