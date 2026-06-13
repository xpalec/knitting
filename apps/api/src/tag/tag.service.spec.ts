import { Test, TestingModule } from '@nestjs/testing';
import { TagService } from './tag.service.js';

jest.mock('../prisma/prisma.service.js', () => ({
  PrismaService: jest.fn(),
}));

import { PrismaService } from '../prisma/prisma.service.js';

const mockPrisma = {
  tag: { findMany: jest.fn() },
};

const makeTags = () => [
  {
    id: 'tag-1',
    translations: [
      { locale: 'en', name: 'Wool', description: null, seo_title: 'Wool knitting', seo_description: 'About wool', status: 'published' },
      { locale: 'pl', name: 'Wełna', description: null, seo_title: null, seo_description: null, status: 'published' },
    ],
    _count: { entries: 3 },
  },
  {
    id: 'tag-2',
    translations: [
      { locale: 'en', name: 'Lace', description: null, seo_title: null, seo_description: null, status: 'published' },
    ],
    _count: { entries: 7 },
  },
];

describe('TagService', () => {
  let service: TagService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<TagService>(TagService);
  });

  describe('findAll', () => {
    it('returns tags with translated name for the requested locale', async () => {
      mockPrisma.tag.findMany.mockResolvedValue(makeTags());

      const result = await service.findAll('pl');

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Wełna');
      expect(result[0]?.entry_count).toBe(3);
    });

    it('falls back to English when requested locale has no translation', async () => {
      mockPrisma.tag.findMany.mockResolvedValue(makeTags());

      const result = await service.findAll('de');

      // lace has no 'de' translation — falls back to 'en'
      expect(result[1]?.name).toBe('Lace');
    });

    it('returns empty string name when no translations exist', async () => {
      mockPrisma.tag.findMany.mockResolvedValue([
        {
          id: 'tag-3',
          translations: [],
          _count: { entries: 0 },
        },
      ]);

      const result = await service.findAll('en');

      expect(result[0]?.name).toBe('');
    });

    it('includes seo_title and seo_description from the resolved translation', async () => {
      mockPrisma.tag.findMany.mockResolvedValue(makeTags());

      const result = await service.findAll('en');

      expect(result[0]?.seo_title).toBe('Wool knitting');
      expect(result[0]?.seo_description).toBe('About wool');
    });

    it('returns empty array when no tags exist', async () => {
      mockPrisma.tag.findMany.mockResolvedValue([]);
      const result = await service.findAll('en');
      expect(result).toEqual([]);
    });
  });
});
