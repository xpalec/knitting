import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AdminCategoryService } from './admin-category.service';

jest.mock('../../prisma/prisma.service.js', () => ({
  PrismaService: jest.fn(),
}));

import { PrismaService } from '../../prisma/prisma.service.js';

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockPrisma = {
  category: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  categoryTranslation: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  entry: {
    findUnique: jest.fn(),
  },
  entryCategory: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('AdminCategoryService', () => {
  let service: AdminCategoryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminCategoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();
    service = module.get<AdminCategoryService>(AdminCategoryService);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a top-level category with an English translation', async () => {
      mockPrisma.categoryTranslation.findUnique.mockResolvedValue(null);
      mockPrisma.category.create.mockResolvedValue({
        id: 'cat-1',
        type: 'entry',
        parent_id: null,
        icon: null,
        sort_order: 0,
        status: 'draft',
        entry_count: 0,
        cover_image_url: null,
        translations: [{ locale: 'en', name: 'Stitches', slug: 'stitches', status: 'draft' }],
      });

      const result = await service.create({ type: 'entry', name_en: 'Stitches', slug_en: 'stitches' });

      expect(result.data.translations[0].name).toBe('Stitches');
      expect(mockPrisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ parent_id: null, type: 'entry' }),
        }),
      );
      expect(mockCache.del).toHaveBeenCalled();
    });

    it('persists the type field when creating a category', async () => {
      mockPrisma.categoryTranslation.findUnique.mockResolvedValue(null);
      mockPrisma.category.create.mockResolvedValue({
        id: 'cat-2',
        type: 'abbreviation',
        parent_id: null,
        icon: null,
        sort_order: 0,
        status: 'draft',
        entry_count: 0,
        cover_image_url: null,
        translations: [{ locale: 'en', name: 'Abbrevs', slug: 'abbrevs', status: 'draft' }],
      });

      const result = await service.create({ type: 'abbreviation', name_en: 'Abbrevs', slug_en: 'abbrevs' });

      expect(result.data.type).toBe('abbreviation');
      expect(mockPrisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'abbreviation' }),
        }),
      );
    });

    it('throws ConflictException when English slug already exists', async () => {
      mockPrisma.categoryTranslation.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ type: 'entry', name_en: 'Stitches', slug_en: 'stitches' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when parent_id does not exist', async () => {
      mockPrisma.categoryTranslation.findUnique.mockResolvedValue(null);
      mockPrisma.category.findUnique.mockResolvedValue(null); // parent not found

      await expect(
        service.create({ type: 'entry', name_en: 'Lace', slug_en: 'lace', parent_id: 'bad-uuid' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('updates status and sort_order', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.category.update.mockResolvedValue({
        id: 'cat-1', type: 'entry', status: 'published', sort_order: 2,
      });

      const result = await service.update('cat-1', { status: 'published', sort_order: 2 });

      expect(result.data.status).toBe('published');
      expect(mockCache.del).toHaveBeenCalled();
    });

    it('updates the type field', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.category.update.mockResolvedValue({
        id: 'cat-1', type: 'article', status: 'draft', sort_order: 0,
      });

      const result = await service.update('cat-1', { type: 'article' });

      expect(result.data.type).toBe('article');
      expect(mockPrisma.category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'article' }),
        }),
      );
    });

    it('does not include type in update data when type is undefined', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.category.update.mockResolvedValue({
        id: 'cat-1', type: 'entry', status: 'published', sort_order: 0,
      });

      await service.update('cat-1', { status: 'published' });

      const updateCall = mockPrisma.category.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('type');
    });

    it('throws BadRequestException when category is set as its own parent', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });

      await expect(
        service.update('cat-1', { parent_id: 'cat-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.update('bad-id', { status: 'published' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    const mockCategories = [
      {
        id: 'cat-1',
        type: 'entry',
        parent_id: null,
        icon: null,
        sort_order: 0,
        status: 'published',
        entry_count: 5,
        cover_image_url: null,
        translations: [{ locale: 'en', name: 'Stitches', slug: 'stitches', status: 'published' }],
        _count: { children: 2 },
      },
      {
        id: 'cat-2',
        type: 'abbreviation',
        parent_id: null,
        icon: null,
        sort_order: 1,
        status: 'draft',
        entry_count: 0,
        cover_image_url: null,
        translations: [{ locale: 'en', name: 'Abbrevs', slug: 'abbrevs', status: 'draft' }],
        _count: { children: 0 },
      },
    ];

    it('includes type in each mapped response object', async () => {
      mockPrisma.category.findMany.mockResolvedValue(mockCategories);
      mockPrisma.category.count.mockResolvedValue(2);

      const result = await service.findAll(1, 50);

      expect(result.data[0].type).toBe('entry');
      expect(result.data[1].type).toBe('abbreviation');
    });

    it('filters by type when type param is provided', async () => {
      mockPrisma.category.findMany.mockResolvedValue([mockCategories[0]]);
      mockPrisma.category.count.mockResolvedValue(1);

      await service.findAll(1, 50, undefined, 'entry');

      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'entry' }),
        }),
      );
      expect(mockPrisma.category.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'entry' }),
        }),
      );
    });

    it('filters by status when status param is provided', async () => {
      mockPrisma.category.findMany.mockResolvedValue([mockCategories[0]]);
      mockPrisma.category.count.mockResolvedValue(1);

      await service.findAll(1, 50, undefined, undefined, 'published');

      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'published' }),
        }),
      );
    });

    it('does not include type or status in where clause when not provided', async () => {
      mockPrisma.category.findMany.mockResolvedValue([]);
      mockPrisma.category.count.mockResolvedValue(0);

      await service.findAll(1, 50);

      const findManyCall = mockPrisma.category.findMany.mock.calls[0][0];
      expect(findManyCall.where).not.toHaveProperty('type');
      expect(findManyCall.where).not.toHaveProperty('status');
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('deletes a category with no entries and no children', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-1', _count: { entries: 0, children: 0 },
      });
      mockPrisma.category.delete.mockResolvedValue({ id: 'cat-1' });

      const result = await service.delete('cat-1');
      expect(result.data.deleted).toBe(true);
      expect(mockCache.del).toHaveBeenCalled();
    });

    it('throws BadRequestException when entries are assigned', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-1', _count: { entries: 3, children: 0 },
      });

      await expect(service.delete('cat-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when child categories exist', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: 'cat-1', _count: { entries: 0, children: 2 },
      });

      await expect(service.delete('cat-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.delete('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // upsertTranslation
  // ---------------------------------------------------------------------------

  describe('upsertTranslation', () => {
    it('upserts a translation with all fields', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.categoryTranslation.findUnique.mockResolvedValue(null); // slug not taken
      mockPrisma.categoryTranslation.upsert.mockResolvedValue({
        category_id: 'cat-1', locale: 'pl', name: 'Ściegi', slug: 'sciegi', status: 'draft',
      });

      const result = await service.upsertTranslation('cat-1', 'pl', {
        name: 'Ściegi',
        slug: 'sciegi',
      });

      expect(result.data.name).toBe('Ściegi');
      expect(mockPrisma.categoryTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category_id_locale: { category_id: 'cat-1', locale: 'pl' } },
        }),
      );
      expect(mockCache.del).toHaveBeenCalledWith('categories:tree:pl');
    });

    it('throws ConflictException when slug is taken by another category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.categoryTranslation.findUnique.mockResolvedValue({
        category_id: 'cat-other', // different category owns this slug
      });

      await expect(
        service.upsertTranslation('cat-1', 'pl', { name: 'Ściegi', slug: 'sciegi' }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows updating the slug on the same category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.categoryTranslation.findUnique.mockResolvedValue({
        category_id: 'cat-1', // same category — allowed
      });
      mockPrisma.categoryTranslation.upsert.mockResolvedValue({
        category_id: 'cat-1', locale: 'pl', name: 'Ściegi', slug: 'sciegi', status: 'draft',
      });

      const result = await service.upsertTranslation('cat-1', 'pl', {
        name: 'Ściegi',
        slug: 'sciegi',
      });
      expect(result.data.slug).toBe('sciegi');
    });

    it('throws NotFoundException for unknown category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertTranslation('bad-id', 'pl', { name: 'Test', slug: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // assignEntryCategories
  // ---------------------------------------------------------------------------

  describe('assignEntryCategories', () => {
    it('replaces entry categories atomically', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.category.findMany.mockResolvedValue([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ]);
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.assignEntryCategories('entry-1', ['cat-1', 'cat-2']);

      expect(result.data.category_ids).toEqual(['cat-1', 'cat-2']);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('throws BadRequestException for unknown category IDs', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);

      await expect(
        service.assignEntryCategories('entry-1', ['cat-1', 'bad-id']),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown entry', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue(null);

      await expect(
        service.assignEntryCategories('bad-entry', ['cat-1']),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows assigning an empty set (removes all categories)', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.assignEntryCategories('entry-1', []);
      expect(result.data.category_ids).toEqual([]);
    });
  });
});
