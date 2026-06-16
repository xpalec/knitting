import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../../../generated/prisma';

jest.mock('../../../prisma/prisma.service.js', () => ({
  PrismaService: jest.fn(),
}));

import { PrismaService } from '../../../prisma/prisma.service.js';
import { AdminAbbreviationService } from '../admin-abbreviation.service';

// ---------------------------------------------------------------------------
// Helper to create a Prisma P2002 unique constraint error
// ---------------------------------------------------------------------------

function makePrismaUniqueError(): Prisma.PrismaClientKnownRequestError {
  return Object.assign(
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    }),
    { code: 'P2002' },
  );
}

// ---------------------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------------------

const mockPrisma = {
  abbreviation: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  abbreviationTranslation: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
  },
  entryAbbreviation: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
  },
  entry: {
    findUnique: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleAbbreviation = {
  id: 'abbr-1',
  code: 'K2tog',
  source_language: 'en',
  created_at: new Date(),
  updated_at: new Date(),
  translations: [],
};

const sampleTranslation = {
  id: 'trans-1',
  abbreviation_id: 'abbr-1',
  locale: 'en',
  short_meaning: 'knit 2 together',
  description: null,
  created_at: new Date(),
  updated_at: new Date(),
};

const sampleLink = {
  entry_id: 'entry-1',
  abbreviation_id: 'abbr-1',
  is_primary: false,
  sort_order: 0,
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AdminAbbreviationService', () => {
  let service: AdminAbbreviationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAbbreviationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<AdminAbbreviationService>(AdminAbbreviationService);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates an abbreviation and returns it with translations', async () => {
      mockPrisma.abbreviation.create.mockResolvedValue(sampleAbbreviation);

      const result = await service.create({ code: 'K2tog', source_language: 'en' });

      expect(result.id).toBe('abbr-1');
      expect(result.code).toBe('K2tog');
      expect(mockPrisma.abbreviation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'K2tog', source_language: 'en' }),
        }),
      );
    });

    it('trims whitespace from code before inserting', async () => {
      mockPrisma.abbreviation.create.mockResolvedValue({ ...sampleAbbreviation, code: 'K2tog' });

      await service.create({ code: '  K2tog  ', source_language: 'en' });

      const call = mockPrisma.abbreviation.create.mock.calls[0][0];
      expect(call.data.code).toBe('K2tog');
    });

    it('throws ConflictException when code+source_language already exists (P2002)', async () => {
      mockPrisma.abbreviation.create.mockRejectedValue(makePrismaUniqueError());

      await expect(
        service.create({ code: 'K2tog', source_language: 'en' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    beforeEach(() => {
      mockPrisma.abbreviation.findMany.mockResolvedValue([sampleAbbreviation]);
      mockPrisma.abbreviation.count.mockResolvedValue(1);
    });

    it('returns paginated data with default page=1 and limit=20', async () => {
      const result = await service.findAll({});

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.data).toHaveLength(1);
    });

    it('applies custom page and limit', async () => {
      mockPrisma.abbreviation.findMany.mockResolvedValue([]);
      mockPrisma.abbreviation.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 3, limit: 10 });

      expect(result.meta.page).toBe(3);
      expect(result.meta.limit).toBe(10);
      expect(mockPrisma.abbreviation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('applies case-insensitive q filter', async () => {
      await service.findAll({ q: 'k2' });

      expect(mockPrisma.abbreviation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            code: expect.objectContaining({ contains: 'k2', mode: 'insensitive' }),
          }),
        }),
      );
    });

    it('applies source_language filter', async () => {
      await service.findAll({ source_language: 'en' });

      expect(mockPrisma.abbreviation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ source_language: 'en' }),
        }),
      );
    });

    it('resolves display_language via exact match in fallback chain', async () => {
      const abbr = {
        ...sampleAbbreviation,
        translations: [
          { locale: 'en', short_meaning: 'knit 2 together' },
          { locale: 'pl', short_meaning: 'oczka razem' },
        ],
      };
      mockPrisma.abbreviation.findMany.mockResolvedValue([abbr]);

      const result = await service.findAll({ display_language: 'pl' });

      expect(result.data[0]).toHaveProperty('resolved_short_meaning', 'oczka razem');
    });

    it('resolves display_language to "en" fallback when exact locale not found', async () => {
      const abbr = {
        ...sampleAbbreviation,
        translations: [{ locale: 'en', short_meaning: 'knit 2 together' }],
      };
      mockPrisma.abbreviation.findMany.mockResolvedValue([abbr]);

      const result = await service.findAll({ display_language: 'de' });

      expect(result.data[0]).toHaveProperty('resolved_short_meaning', 'knit 2 together');
    });

    it('resolves display_language to first translation when no exact or en match', async () => {
      const abbr = {
        ...sampleAbbreviation,
        translations: [{ locale: 'pl', short_meaning: 'oczka razem' }],
      };
      mockPrisma.abbreviation.findMany.mockResolvedValue([abbr]);

      const result = await service.findAll({ display_language: 'de' });

      expect(result.data[0]).toHaveProperty('resolved_short_meaning', 'oczka razem');
    });

    it('returns null resolved_short_meaning when no translations exist', async () => {
      const abbr = { ...sampleAbbreviation, translations: [] };
      mockPrisma.abbreviation.findMany.mockResolvedValue([abbr]);

      const result = await service.findAll({ display_language: 'en' });

      expect(result.data[0]).toHaveProperty('resolved_short_meaning', null);
    });

    it('does not add resolved_short_meaning when display_language is not provided', async () => {
      const result = await service.findAll({});

      expect(result.data[0]).not.toHaveProperty('resolved_short_meaning');
    });

    it('includes total count in meta', async () => {
      mockPrisma.abbreviation.count.mockResolvedValue(42);

      const result = await service.findAll({});

      expect(result.meta.total).toBe(42);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------

  describe('findOne', () => {
    it('returns the abbreviation with translations and entry_abbreviations', async () => {
      const full = {
        ...sampleAbbreviation,
        translations: [sampleTranslation],
        entry_abbreviations: [],
      };
      mockPrisma.abbreviation.findUnique.mockResolvedValue(full);

      const result = await service.findOne('abbr-1');

      expect(result.id).toBe('abbr-1');
      expect(result.translations).toHaveLength(1);
      expect(mockPrisma.abbreviation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'abbr-1' },
          include: expect.objectContaining({ translations: true, entry_abbreviations: true }),
        }),
      );
    });

    it('throws NotFoundException when abbreviation does not exist', async () => {
      mockPrisma.abbreviation.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    beforeEach(() => {
      // assertExists call
      mockPrisma.abbreviation.findUnique.mockResolvedValueOnce({ id: 'abbr-1' });
    });

    it('updates code and source_language', async () => {
      mockPrisma.abbreviation.update.mockResolvedValue({
        ...sampleAbbreviation,
        code: 'ssk',
        source_language: 'en',
      });

      const result = await service.update('abbr-1', { code: 'ssk', source_language: 'en' });

      expect(result.code).toBe('ssk');
      expect(mockPrisma.abbreviation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'abbr-1' },
          data: expect.objectContaining({ code: 'ssk', source_language: 'en' }),
        }),
      );
    });

    it('trims whitespace from code on update', async () => {
      mockPrisma.abbreviation.update.mockResolvedValue({ ...sampleAbbreviation, code: 'ssk' });

      await service.update('abbr-1', { code: '  ssk  ' });

      const call = mockPrisma.abbreviation.update.mock.calls[0][0];
      expect(call.data.code).toBe('ssk');
    });

    it('throws ConflictException on P2002 during update', async () => {
      mockPrisma.abbreviation.update.mockRejectedValue(makePrismaUniqueError());

      await expect(
        service.update('abbr-1', { code: 'K2tog' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when abbreviation does not exist', async () => {
      // override: assertExists returns null
      mockPrisma.abbreviation.findUnique.mockReset();
      mockPrisma.abbreviation.findUnique.mockResolvedValue(null);

      await expect(service.update('bad-id', { code: 'ssk' })).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('deletes an existing abbreviation (cascades handled by Prisma)', async () => {
      mockPrisma.abbreviation.findUnique.mockResolvedValue({ id: 'abbr-1' });
      mockPrisma.abbreviation.delete.mockResolvedValue({ id: 'abbr-1' });

      await expect(service.delete('abbr-1')).resolves.toBeUndefined();
      expect(mockPrisma.abbreviation.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'abbr-1' } }),
      );
    });

    it('throws NotFoundException when abbreviation does not exist', async () => {
      mockPrisma.abbreviation.findUnique.mockResolvedValue(null);

      await expect(service.delete('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // createTranslation
  // ---------------------------------------------------------------------------

  describe('createTranslation', () => {
    it('creates a translation for an existing abbreviation', async () => {
      mockPrisma.abbreviation.findUnique.mockResolvedValue({ id: 'abbr-1' });
      mockPrisma.abbreviationTranslation.create.mockResolvedValue(sampleTranslation);

      const result = await service.createTranslation('abbr-1', {
        locale: 'en',
        short_meaning: 'knit 2 together',
      });

      expect(result.locale).toBe('en');
      expect(mockPrisma.abbreviationTranslation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ abbreviation_id: 'abbr-1', locale: 'en' }),
        }),
      );
    });

    it('throws NotFoundException when parent abbreviation does not exist', async () => {
      mockPrisma.abbreviation.findUnique.mockResolvedValue(null);

      await expect(
        service.createTranslation('bad-id', { locale: 'en' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when locale already exists for the abbreviation (P2002)', async () => {
      mockPrisma.abbreviation.findUnique.mockResolvedValue({ id: 'abbr-1' });
      mockPrisma.abbreviationTranslation.create.mockRejectedValue(makePrismaUniqueError());

      await expect(
        service.createTranslation('abbr-1', { locale: 'en' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // updateTranslation
  // ---------------------------------------------------------------------------

  describe('updateTranslation', () => {
    it('updates an existing translation', async () => {
      // assertExists for abbreviation
      mockPrisma.abbreviation.findUnique.mockResolvedValue({ id: 'abbr-1' });
      // assertTranslationExists
      mockPrisma.abbreviationTranslation.findUnique.mockResolvedValue({ abbreviation_id: 'abbr-1' });
      mockPrisma.abbreviationTranslation.update.mockResolvedValue({
        ...sampleTranslation,
        short_meaning: 'slip, slip, knit',
      });

      const result = await service.updateTranslation('abbr-1', 'en', {
        short_meaning: 'slip, slip, knit',
      });

      expect(result.short_meaning).toBe('slip, slip, knit');
      expect(mockPrisma.abbreviationTranslation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { abbreviation_id_locale: { abbreviation_id: 'abbr-1', locale: 'en' } },
        }),
      );
    });

    it('throws NotFoundException when parent abbreviation does not exist', async () => {
      mockPrisma.abbreviation.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTranslation('bad-id', 'en', { short_meaning: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when locale translation does not exist', async () => {
      mockPrisma.abbreviation.findUnique.mockResolvedValue({ id: 'abbr-1' });
      mockPrisma.abbreviationTranslation.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTranslation('abbr-1', 'de', { short_meaning: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteTranslation
  // ---------------------------------------------------------------------------

  describe('deleteTranslation', () => {
    it('deletes an existing translation', async () => {
      mockPrisma.abbreviation.findUnique.mockResolvedValue({ id: 'abbr-1' });
      mockPrisma.abbreviationTranslation.findUnique.mockResolvedValue({ abbreviation_id: 'abbr-1' });
      mockPrisma.abbreviationTranslation.delete.mockResolvedValue({ abbreviation_id: 'abbr-1' });

      await expect(service.deleteTranslation('abbr-1', 'en')).resolves.toBeUndefined();
      expect(mockPrisma.abbreviationTranslation.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { abbreviation_id_locale: { abbreviation_id: 'abbr-1', locale: 'en' } },
        }),
      );
    });

    it('throws NotFoundException when parent abbreviation does not exist', async () => {
      mockPrisma.abbreviation.findUnique.mockResolvedValue(null);

      await expect(service.deleteTranslation('bad-id', 'en')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when locale translation does not exist', async () => {
      mockPrisma.abbreviation.findUnique.mockResolvedValue({ id: 'abbr-1' });
      mockPrisma.abbreviationTranslation.findUnique.mockResolvedValue(null);

      await expect(service.deleteTranslation('abbr-1', 'de')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // linkEntry
  // ---------------------------------------------------------------------------

  describe('linkEntry', () => {
    it('links an abbreviation to an entry with defaults', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue({ id: 'entry-1' });
      // assertExists for abbreviation
      mockPrisma.abbreviation.findUnique.mockResolvedValue({ id: 'abbr-1' });
      mockPrisma.entryAbbreviation.create.mockResolvedValue(sampleLink);

      const result = await service.linkEntry('entry-1', { abbreviation_id: 'abbr-1' });

      expect(result.entry_id).toBe('entry-1');
      expect(result.abbreviation_id).toBe('abbr-1');
      expect(result.is_primary).toBe(false);
      expect(result.sort_order).toBe(0);
      expect(mockPrisma.entryAbbreviation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entry_id: 'entry-1',
            abbreviation_id: 'abbr-1',
            is_primary: false,
            sort_order: 0,
          }),
        }),
      );
    });

    it('links with explicit is_primary and sort_order', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.abbreviation.findUnique.mockResolvedValue({ id: 'abbr-1' });
      mockPrisma.entryAbbreviation.create.mockResolvedValue({
        ...sampleLink,
        is_primary: true,
        sort_order: 5,
      });

      const result = await service.linkEntry('entry-1', {
        abbreviation_id: 'abbr-1',
        is_primary: true,
        sort_order: 5,
      });

      expect(result.is_primary).toBe(true);
      expect(result.sort_order).toBe(5);
    });

    it('throws NotFoundException when entry does not exist', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue(null);

      await expect(
        service.linkEntry('bad-entry', { abbreviation_id: 'abbr-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when abbreviation does not exist', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.abbreviation.findUnique.mockResolvedValue(null);

      await expect(
        service.linkEntry('entry-1', { abbreviation_id: 'bad-abbr' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when abbreviation is already linked to the entry (P2002)', async () => {
      mockPrisma.entry.findUnique.mockResolvedValue({ id: 'entry-1' });
      mockPrisma.abbreviation.findUnique.mockResolvedValue({ id: 'abbr-1' });
      mockPrisma.entryAbbreviation.create.mockRejectedValue(makePrismaUniqueError());

      await expect(
        service.linkEntry('entry-1', { abbreviation_id: 'abbr-1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // updateLink
  // ---------------------------------------------------------------------------

  describe('updateLink', () => {
    it('updates the join record metadata', async () => {
      mockPrisma.entryAbbreviation.findUnique.mockResolvedValue(sampleLink);
      mockPrisma.entryAbbreviation.update.mockResolvedValue({
        ...sampleLink,
        is_primary: true,
        sort_order: 3,
      });

      const result = await service.updateLink('entry-1', 'abbr-1', {
        is_primary: true,
        sort_order: 3,
      });

      expect(result.is_primary).toBe(true);
      expect(result.sort_order).toBe(3);
      expect(mockPrisma.entryAbbreviation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            entry_id_abbreviation_id: { entry_id: 'entry-1', abbreviation_id: 'abbr-1' },
          },
        }),
      );
    });

    it('throws NotFoundException when join row does not exist', async () => {
      mockPrisma.entryAbbreviation.findUnique.mockResolvedValue(null);

      await expect(
        service.updateLink('entry-1', 'bad-abbr', { is_primary: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // unlinkEntry
  // ---------------------------------------------------------------------------

  describe('unlinkEntry', () => {
    it('removes the join row between entry and abbreviation', async () => {
      mockPrisma.entryAbbreviation.findUnique.mockResolvedValue(sampleLink);
      mockPrisma.entryAbbreviation.delete.mockResolvedValue(sampleLink);

      await expect(service.unlinkEntry('entry-1', 'abbr-1')).resolves.toBeUndefined();
      expect(mockPrisma.entryAbbreviation.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            entry_id_abbreviation_id: { entry_id: 'entry-1', abbreviation_id: 'abbr-1' },
          },
        }),
      );
    });

    it('throws NotFoundException when join row does not exist', async () => {
      mockPrisma.entryAbbreviation.findUnique.mockResolvedValue(null);

      await expect(service.unlinkEntry('entry-1', 'bad-abbr')).rejects.toThrow(NotFoundException);
    });
  });
});
