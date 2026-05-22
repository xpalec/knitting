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

  describe('getTree', () => {
    it('returns cached tree when available', async () => {
      const cachedTree = [{ id: '1', name: 'Lace', slug: 'lace', icon: null, sort_order: 0, children: [] }];
      mockCache.get.mockResolvedValue(cachedTree);

      const result = await service.getTree();

      expect(result).toEqual(cachedTree);
      expect(mockPrisma.category.findMany).not.toHaveBeenCalled();
    });

    it('builds tree from DB and caches it when cache is empty', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.category.findMany.mockResolvedValue([
        { id: '1', name: 'Lace', slug: 'lace', icon: null, sort_order: 0, parent_id: null },
        { id: '2', name: 'Socks', slug: 'socks', icon: null, sort_order: 1, parent_id: null },
        { id: '3', name: 'Toe-up', slug: 'toe-up', icon: null, sort_order: 0, parent_id: '2' },
      ]);

      const result = await service.getTree();

      expect(result).toHaveLength(2);
      expect(result[1]?.children).toHaveLength(1);
      expect(result[1]?.children[0]?.slug).toBe('toe-up');
      expect(mockCache.set).toHaveBeenCalledWith(
        'categories:tree',
        result,
        expect.any(Number),
      );
    });

    it('returns empty array when no categories exist', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.category.findMany.mockResolvedValue([]);

      const result = await service.getTree();
      expect(result).toEqual([]);
    });
  });

  describe('getEntriesByCategory', () => {
    it('returns null when category slug not found', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const result = await service.getEntriesByCategory('nonexistent', 'en', 1, 20);
      expect(result).toBeNull();
    });

    it('returns paginated entries for a valid category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', slug: 'lace' });
      mockPrisma.entry.findMany.mockResolvedValue([
        {
          origin_language: 'en',
          status: 'published',
          metadata: { skill_level: 'intermediate' },
          translations: [{ term: 'Lace stitch', slug: 'lace-stitch', metadata: {}, status: 'published' }],
        },
      ]);
      mockPrisma.entry.count.mockResolvedValue(1);

      const result = await service.getEntriesByCategory('lace', 'en', 1, 20);

      expect(result).not.toBeNull();
      expect(result?.entries).toHaveLength(1);
      expect(result?.entries[0]?.term).toBe('Lace stitch');
      expect(result?.meta.total).toBe(1);
    });

    it('flags entries with missing translations', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', slug: 'lace' });
      mockPrisma.entry.findMany.mockResolvedValue([
        {
          origin_language: 'pl',
          status: 'published',
          metadata: {},
          translations: [], // no translation for requested locale
        },
      ]);
      mockPrisma.entry.count.mockResolvedValue(1);

      const result = await service.getEntriesByCategory('lace', 'de', 1, 20);

      expect(result?.entries[0]?.missing_translation).toBe(true);
      expect(result?.entries[0]?.term).toBeNull();
    });
  });

  describe('invalidateCache', () => {
    it('deletes the tree cache key', async () => {
      await service.invalidateCache();
      expect(mockCache.del).toHaveBeenCalledWith('categories:tree');
    });
  });
});
