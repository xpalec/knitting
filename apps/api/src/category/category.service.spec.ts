import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CategoryService } from './category.service.js';

// Mock PrismaService to avoid loading the generated Prisma client (which uses import.meta)
jest.mock('../prisma/prisma.service.js', () => ({
  PrismaService: jest.fn(),
}));

import { PrismaService } from '../prisma/prisma.service.js';

const mockPrisma = {
  category: {
    findMany: jest.fn(),
  },
  categoryTranslation: {
    findUnique: jest.fn(),
  },
  entry: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const enTranslation = { locale: 'en', slug: 'stitches', name: 'Stitches', status: 'published' };
const plTranslation = { locale: 'pl', slug: 'sciegi',   name: 'Ściegi',   status: 'published' };

const flatCategories = [
  {
    id: '1', parent_id: null, icon: null, sort_order: 0,
    status: 'published', entry_count: 5, cover_image_url: null,
    translations: [enTranslation, plTranslation],
  },
  {
    id: '2', parent_id: null, icon: null, sort_order: 1,
    status: 'published', entry_count: 3, cover_image_url: null,
    translations: [
      { locale: 'en', slug: 'techniques', name: 'Techniques', status: 'published' },
    ],
  },
  {
    id: '3', parent_id: '2', icon: null, sort_order: 0,
    status: 'published', entry_count: 1, cover_image_url: null,
    translations: [
      { locale: 'en', slug: 'colorwork', name: 'Colorwork', status: 'published' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CategoryService', () => {
  let service: CategoryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  // -------------------------------------------------------------------------
  // getTree
  // -------------------------------------------------------------------------

  describe('getTree', () => {
    it('returns cached tree when available', async () => {
      const cachedTree = [{ id: '1', translation: enTranslation, children: [] }];
      mockCache.get.mockResolvedValue(cachedTree);

      const result = await service.getTree('en');

      expect(result).toEqual(cachedTree);
      expect(mockPrisma.category.findMany).not.toHaveBeenCalled();
    });

    it('uses locale-scoped cache key', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.category.findMany.mockResolvedValue([]);

      await service.getTree('pl');

      expect(mockCache.get).toHaveBeenCalledWith('categories:tree:pl');
      expect(mockCache.set).toHaveBeenCalledWith(
        'categories:tree:pl',
        expect.any(Array),
        expect.any(Number),
      );
    });

    it('builds nested tree from flat DB rows', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.category.findMany.mockResolvedValue(flatCategories);

      const result = await service.getTree('en');

      expect(result).toHaveLength(2);
      expect(result[1]?.children).toHaveLength(1);
      expect(result[1]?.children[0]?.translation?.slug).toBe('colorwork');
    });

    it('returns locale-specific translation when available', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.category.findMany.mockResolvedValue(flatCategories);

      const result = await service.getTree('pl');

      expect(result[0]?.translation?.name).toBe('Ściegi');
      expect(result[0]?.translation?.slug).toBe('sciegi');
    });

    it('falls back to English translation when locale not available', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.category.findMany.mockResolvedValue(flatCategories);

      // Category 2 only has 'en' translation — requesting 'de' should fall back
      const result = await service.getTree('de');

      expect(result[1]?.translation?.locale).toBe('en');
      expect(result[1]?.translation?.name).toBe('Techniques');
    });

    it('sets translation to null when no translations exist', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: '99', parent_id: null, icon: null, sort_order: 0,
          status: 'published', entry_count: 0, cover_image_url: null,
          translations: [],
        },
      ]);

      const result = await service.getTree('en');

      expect(result[0]?.translation).toBeNull();
    });

    it('returns empty array when no categories exist', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.category.findMany.mockResolvedValue([]);

      const result = await service.getTree('en');
      expect(result).toEqual([]);
    });

    it('exposes entry_count and cover_image_url on each node', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: '1', parent_id: null, icon: 'star', sort_order: 0,
          status: 'published', entry_count: 42,
          cover_image_url: 'https://cdn.example.com/cat.jpg',
          translations: [enTranslation],
        },
      ]);

      const result = await service.getTree('en');

      expect(result[0]?.entry_count).toBe(42);
      expect(result[0]?.cover_image_url).toBe('https://cdn.example.com/cat.jpg');
      expect(result[0]?.icon).toBe('star');
    });
  });

  // -------------------------------------------------------------------------
  // getEntriesByCategory
  // -------------------------------------------------------------------------

  describe('getEntriesByCategory', () => {
    it('returns null when locale+slug combination not found', async () => {
      mockPrisma.categoryTranslation.findUnique.mockResolvedValue(null);

      const result = await service.getEntriesByCategory('nonexistent', 'en', 1, 20);
      expect(result).toBeNull();
    });

    it('resolves category via CategoryTranslation (locale + slug)', async () => {
      mockPrisma.categoryTranslation.findUnique.mockResolvedValue({
        locale: 'pl', slug: 'sciegi', name: 'Ściegi', status: 'published',
        category: { id: 'cat-1', icon: null, sort_order: 0, entry_count: 1, cover_image_url: null },
      });
      mockPrisma.entry.findMany.mockResolvedValue([]);
      mockPrisma.entry.count.mockResolvedValue(0);

      await service.getEntriesByCategory('sciegi', 'pl', 1, 20);

      expect(mockPrisma.categoryTranslation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { locale_slug: { locale: 'pl', slug: 'sciegi' } },
        }),
      );
    });

    it('returns paginated entries for a valid category', async () => {
      mockPrisma.categoryTranslation.findUnique.mockResolvedValue({
        locale: 'en', slug: 'stitches', name: 'Stitches', status: 'published',
        category: { id: 'cat-1', icon: null, sort_order: 0, entry_count: 1, cover_image_url: null },
      });
      mockPrisma.entry.findMany.mockResolvedValue([
        {
          origin_language: 'en',
          status: 'published',
          metadata: { skill_level: 'intermediate' },
          translations: [{ term: 'Lace stitch', slug: 'lace-stitch', metadata: {}, status: 'published' }],
        },
      ]);
      mockPrisma.entry.count.mockResolvedValue(1);

      const result = await service.getEntriesByCategory('stitches', 'en', 1, 20);

      expect(result).not.toBeNull();
      expect(result?.entries).toHaveLength(1);
      expect(result?.entries[0]?.term).toBe('Lace stitch');
      expect(result?.meta.total).toBe(1);
    });

    it('flags entries with missing translations', async () => {
      mockPrisma.categoryTranslation.findUnique.mockResolvedValue({
        locale: 'de', slug: 'stiche', name: 'Stiche', status: 'published',
        category: { id: 'cat-1', icon: null, sort_order: 0, entry_count: 1, cover_image_url: null },
      });
      mockPrisma.entry.findMany.mockResolvedValue([
        {
          origin_language: 'pl',
          status: 'published',
          metadata: {},
          translations: [], // no translation for requested locale
        },
      ]);
      mockPrisma.entry.count.mockResolvedValue(1);

      const result = await service.getEntriesByCategory('stiche', 'de', 1, 20);

      expect(result?.entries[0]?.missing_translation).toBe(true);
      expect(result?.entries[0]?.term).toBeNull();
    });

    it('includes category translation in response', async () => {
      mockPrisma.categoryTranslation.findUnique.mockResolvedValue({
        locale: 'pl', slug: 'sciegi', name: 'Ściegi', status: 'published',
        category: { id: 'cat-1', icon: null, sort_order: 0, entry_count: 5, cover_image_url: null },
      });
      mockPrisma.entry.findMany.mockResolvedValue([]);
      mockPrisma.entry.count.mockResolvedValue(0);

      const result = await service.getEntriesByCategory('sciegi', 'pl', 1, 20);

      expect(result?.category.translation.name).toBe('Ściegi');
      expect(result?.category.translation.slug).toBe('sciegi');
      expect(result?.category.entry_count).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // invalidateCache
  // -------------------------------------------------------------------------

  describe('invalidateCache', () => {
    it('deletes the specific locale cache key when locale provided', async () => {
      await service.invalidateCache('pl');
      expect(mockCache.del).toHaveBeenCalledWith('categories:tree:pl');
      expect(mockCache.del).toHaveBeenCalledTimes(1);
    });

    it('deletes all locale cache keys when no locale provided', async () => {
      await service.invalidateCache();
      expect(mockCache.del).toHaveBeenCalledTimes(5); // en, pl, de, no, fr
    });
  });
});
