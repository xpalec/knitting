import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AdminTagService } from './admin-tag.service.js';

jest.mock('../../prisma/prisma.service.js', () => ({
  PrismaService: jest.fn(),
}));

import { PrismaService } from '../../prisma/prisma.service.js';

const mockPrisma = {
  tag: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  tagTranslation: {
    upsert: jest.fn(),
  },
  entry: {
    findUnique: jest.fn(),
  },
  entryTag: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('AdminTagService', () => {
  let service: AdminTagService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminTagService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<AdminTagService>(AdminTagService);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a tag with an English translation', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(null);
      mockPrisma.tag.create.mockResolvedValue({
        id: 'tag-1', slug: 'fair-isle', type: 'style_tradition', color_hex: '#228B22',
        translations: [{ locale: 'en', name: 'Fair Isle', status: 'draft' }],
      });

      const result = await service.create({
        slug: 'fair-isle', type: 'style_tradition', color_hex: '#228B22', name_en: 'Fair Isle',
      });

      expect(result.data.slug).toBe('fair-isle');
      expect(mockPrisma.tag.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'fair-isle' }),
        }),
      );
    });

    it('throws ConflictException when slug already exists', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ slug: 'wool', name_en: 'Wool' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('updates type and color_hex', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({ id: 'tag-1' });
      mockPrisma.tag.update.mockResolvedValue({ slug: 'wool', color_hex: '#FF0000' });

      const result = await service.update('wool', { color_hex: '#FF0000' });

      expect(result.data.color_hex).toBe('#FF0000');
    });

    it('throws NotFoundException for unknown slug', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(null);
      await expect(service.update('nonexistent', {})).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('deletes a tag with no entries', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({
        id: 'tag-1', slug: 'dpn', _count: { entries: 0 },
      });
      mockPrisma.tag.delete.mockResolvedValue({ slug: 'dpn' });

      const result = await service.delete('dpn');
      expect(result.data.deleted).toBe(true);
    });

    it('throws BadRequestException when entries are assigned', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({
        id: 'tag-1', slug: 'wool', _count: { entries: 5 },
      });

      await expect(service.delete('wool')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown slug', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(null);
      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // upsertTranslation
  // ---------------------------------------------------------------------------

  describe('upsertTranslation', () => {
    it('upserts a translation with all fields', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({ id: 'tag-1' });
      mockPrisma.tagTranslation.upsert.mockResolvedValue({
        tag_id: 'tag-1', locale: 'pl', name: 'Wełna',
        description: null, seo_title: null, seo_description: null, status: 'draft',
      });

      const result = await service.upsertTranslation('wool', 'pl', { name: 'Wełna' });

      expect(result.data.name).toBe('Wełna');
      expect(mockPrisma.tagTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tag_id_locale: { tag_id: 'tag-1', locale: 'pl' } },
        }),
      );
    });

    it('throws NotFoundException for unknown tag slug', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(null);
      await expect(
        service.upsertTranslation('nonexistent', 'pl', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // assignEntryTags
  // ---------------------------------------------------------------------------

  describe('assignEntryTags', () => {
    it('replaces entry tags atomically', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.tag.findMany.mockResolvedValue([
        { id: 'tag-1', slug: 'wool' },
        { id: 'tag-2', slug: 'lace' },
      ]);
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.assignEntryTags('entry-1', ['wool', 'lace']);

      expect(result.data.tags).toEqual(['wool', 'lace']);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('throws BadRequestException for unknown tag slugs', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.tag.findMany.mockResolvedValue([{ id: 'tag-1', slug: 'wool' }]);

      await expect(
        service.assignEntryTags('entry-1', ['wool', 'nonexistent']),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown entry', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue(null);
      await expect(
        service.assignEntryTags('bad-id', ['wool']),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows assigning an empty set (removes all tags)', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.tag.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.assignEntryTags('entry-1', []);
      expect(result.data.tags).toEqual([]);
    });
  });
});
