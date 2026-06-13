import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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

  describe('create', () => {
    it('creates a tag with an English translation (no slug required)', async () => {
      mockPrisma.tag.create.mockResolvedValue({
        id: 'tag-1',
        translations: [{ locale: 'en', slug: 'fair-isle', name: 'Fair Isle', status: 'draft' }],
      });

      const result = await service.create({ name_en: 'Fair Isle' });

      expect(result.data.id).toBe('tag-1');
      expect(mockPrisma.tag.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            translations: expect.objectContaining({
              create: expect.objectContaining({ name: 'Fair Isle', locale: 'en' }),
            }),
          }),
        }),
      );
    });

    it('auto-derives en slug from name_en when slug_en is omitted', async () => {
      mockPrisma.tag.create.mockResolvedValue({
        id: 'tag-1',
        translations: [{ locale: 'en', slug: 'fair-isle', name: 'Fair Isle', status: 'draft' }],
      });

      await service.create({ name_en: 'Fair Isle' });

      const call = mockPrisma.tag.create.mock.calls[0][0];
      expect(call.data.translations.create.slug).toBe('fair-isle');
    });
  });

  describe('delete', () => {
    it('deletes a tag with no entries', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({
        id: 'tag-1', _count: { entries: 0 },
      });
      mockPrisma.tag.delete.mockResolvedValue({ id: 'tag-1' });

      const result = await service.delete('tag-1');
      expect(result.data.deleted).toBe(true);
    });

    it('throws BadRequestException when entries are assigned', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({
        id: 'tag-1', _count: { entries: 5 },
      });

      await expect(service.delete('tag-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(null);
      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertTranslation', () => {
    it('upserts a translation by tag id', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({ id: 'tag-1' });
      mockPrisma.tagTranslation.upsert.mockResolvedValue({
        tag_id: 'tag-1', locale: 'pl', name: 'Wełna',
        description: null, seo_title: null, seo_description: null, status: 'draft',
      });

      const result = await service.upsertTranslation('tag-1', 'pl', { name: 'Wełna', slug: 'welna' });

      expect(result.data.name).toBe('Wełna');
      expect(mockPrisma.tagTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tag_id_locale: { tag_id: 'tag-1', locale: 'pl' } },
        }),
      );
    });

    it('throws NotFoundException for unknown tag id', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(null);
      await expect(
        service.upsertTranslation('nonexistent', 'pl', { name: 'Test', slug: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignEntryTags', () => {
    it('replaces entry tags atomically using tag IDs', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.tag.findMany.mockResolvedValue([
        { id: 'tag-1' },
        { id: 'tag-2' },
      ]);
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.assignEntryTags('entry-1', ['tag-1', 'tag-2']);

      expect(result.data.tag_ids).toEqual(['tag-1', 'tag-2']);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('throws BadRequestException for unknown tag IDs', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.tag.findMany.mockResolvedValue([{ id: 'tag-1' }]);

      await expect(
        service.assignEntryTags('entry-1', ['tag-1', 'nonexistent']),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown entry', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue(null);
      await expect(
        service.assignEntryTags('bad-id', ['tag-1']),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows assigning an empty set', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.tag.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.assignEntryTags('entry-1', []);
      expect(result.data.tag_ids).toEqual([]);
    });
  });
});
