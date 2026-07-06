/**
 * Property-based tests for MediaService upload logic.
 * Uses fast-check with Jest as the test runner.
 *
 * Feature: image-multi-size-upload
 * Requirements: 1.6, 2.9
 */
import * as fc from 'fast-check';
import sharp from 'sharp';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { MediaService } from './media.service';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a synthetic PNG image buffer of the requested dimensions using Sharp.
 * Used to provide a real image buffer so that `resizeVariant` (which calls Sharp
 * internally) does not fail with an "unsupported image format" error.
 */
async function createSyntheticPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 100, g: 150, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * Builds a minimal Express.Multer.File-like object for a PNG image.
 */
function makeMulterFile(buffer: Buffer, filename = 'test-image.png'): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype: 'image/png',
    buffer,
    size: buffer.length,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };
}

// ---------------------------------------------------------------------------
// Property 4: Upload aborts and cleans up on R2 failure
// ---------------------------------------------------------------------------

describe('Feature: image-multi-size-upload, Property 4: Upload aborts and cleans up on R2 failure', () => {
  /**
   * Validates: Requirements 1.6, 2.9
   *
   * For any valid upload where one of the S3 PutObjectCommand calls throws,
   * no MediaAsset database row is created and a DeleteObjectCommand is
   * attempted for each already-uploaded key.
   */
  it('aborts upload and issues DeleteObjectCommand for each already-uploaded key when a PutObjectCommand fails', async () => {
    // Use a fixed synthetic image so we do not regenerate it on every fc run
    const imageBuffer = await createSyntheticPng(400, 300);
    const multerFile = makeMulterFile(imageBuffer);

    await fc.assert(
      fc.asyncProperty(
        // Which variant index (0=original, 1=medium, 2=small) throws
        fc.integer({ min: 0, max: 2 }),
        async (failingVariantIndex) => {
          // ----------------------------------------------------------------
          // Build mocks
          // ----------------------------------------------------------------

          // Track which S3 commands are sent
          const sentCommands: Array<PutObjectCommand | DeleteObjectCommand> = [];
          let putCallCount = 0;

          const mockS3Send = jest.fn().mockImplementation((command: unknown) => {
            sentCommands.push(command as PutObjectCommand | DeleteObjectCommand);

            if (command instanceof PutObjectCommand) {
              const callIndex = putCallCount;
              putCallCount++;
              if (callIndex === failingVariantIndex) {
                return Promise.reject(new Error(`Simulated R2 failure on variant ${callIndex}`));
              }
            }
            // DeleteObjectCommand always succeeds (best-effort cleanup)
            return Promise.resolve({});
          });

          // Mock PrismaService — entity lookup returns a valid entity;
          // mediaAsset.create should never be called.
          const mockPrisma = {
            entry: {
              findUnique: jest.fn().mockResolvedValue({ id: 'test-entry-id' }),
            },
            article: {
              findUnique: jest.fn().mockResolvedValue({ id: 'test-article-id' }),
            },
            mediaAsset: {
              create: jest.fn().mockResolvedValue({}),
              count: jest.fn().mockResolvedValue(0),
            },
          } as unknown as PrismaService;

          // ----------------------------------------------------------------
          // Build service with injected mocks
          // ----------------------------------------------------------------
          const service = new MediaService(mockPrisma);

          // Replace the private S3 client's send method with our mock
          (service as any).s3 = { send: mockS3Send } as unknown as S3Client;

          // ----------------------------------------------------------------
          // Execute — expect the upload to throw
          // ----------------------------------------------------------------
          await expect(
            service.uploadForEntity('entry', 'test-entry-id', multerFile),
          ).rejects.toThrow();

          // ----------------------------------------------------------------
          // Assertions
          // ----------------------------------------------------------------

          // 1. No MediaAsset row should have been created
          expect(mockPrisma.mediaAsset.create).not.toHaveBeenCalled();

          // 2. Count how many PutObjectCommand calls actually succeeded
          //    (all calls before the failing index)
          const successfulPuts = failingVariantIndex; // 0, 1, or 2

          // 3. For each successfully uploaded key, a DeleteObjectCommand
          //    must have been attempted
          const deleteCommands = sentCommands.filter(
            (cmd) => cmd instanceof DeleteObjectCommand,
          );

          expect(deleteCommands.length).toBe(successfulPuts);
        },
      ),
      { numRuns: 100 },
    );
  }, 120_000);
});

// ---------------------------------------------------------------------------
// Property 5: Stored MediaAsset has correct polymorphic fields
// ---------------------------------------------------------------------------

describe('Feature: image-multi-size-upload, Property 5: Stored MediaAsset has correct polymorphic fields', () => {
  /**
   * Validates: Requirements 2.1
   *
   * For any upload targeting entity type T and entity id I, the created
   * MediaAsset row SHALL have source_type = T and source_id = I.
   */
  it('mediaAsset.create is called with the generated source_type and source_id', async () => {
    // Synthetic PNG buffer created once — reused across all iterations for speed
    const pngBuffer = await createSyntheticPng(10, 10);

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sourceType: fc.constantFrom('entry' as const, 'article' as const),
          sourceId: fc.uuid(),
        }),
        async ({ sourceType, sourceId }) => {
          // ----------------------------------------------------------------
          // Build mock PrismaService
          // ----------------------------------------------------------------
          const mockAsset = {
            id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            source_id: sourceId,
            source_type: sourceType,
            type: 'image',
            url_original: `https://media.example.com/${sourceType}/${sourceId}/original.png`,
            url_medium: `https://media.example.com/${sourceType}/${sourceId}/medium.webp`,
            url_small: `https://media.example.com/${sourceType}/${sourceId}/small.webp`,
            alt_text: null,
            filename: 'test-image.png',
            sort_order: 0,
            created_at: new Date(),
            updated_at: new Date(),
          };

          const mockCreate = jest.fn().mockResolvedValue(mockAsset);
          const mockCount = jest.fn().mockResolvedValue(0);
          const mockFindUnique = jest.fn().mockResolvedValue({ id: sourceId });

          const mockPrisma = {
            entry: { findUnique: mockFindUnique },
            article: { findUnique: mockFindUnique },
            mediaAsset: {
              create: mockCreate,
              count: mockCount,
            },
          } as unknown as PrismaService;

          // ----------------------------------------------------------------
          // Build service with mocked S3 send (all PutObjectCommands succeed)
          // ----------------------------------------------------------------
          const service = new MediaService(mockPrisma);
          const mockSend = jest.fn().mockResolvedValue({});
          (service as any).s3 = { send: mockSend } as unknown as S3Client;

          // ----------------------------------------------------------------
          // Call uploadForEntity with a synthetic PNG file
          // ----------------------------------------------------------------
          const mockFile: Express.Multer.File = {
            fieldname: 'file',
            originalname: 'test-image.png',
            encoding: '7bit',
            mimetype: 'image/png',
            size: pngBuffer.length,
            buffer: pngBuffer,
            stream: null as any,
            destination: '',
            filename: 'test-image.png',
            path: '',
          };

          await service.uploadForEntity(sourceType, sourceId, mockFile);

          // ----------------------------------------------------------------
          // Assert: mediaAsset.create was called with the correct polymorphic fields
          // ----------------------------------------------------------------
          expect(mockCreate).toHaveBeenCalledTimes(1);

          const createCallArg = mockCreate.mock.calls[0][0] as {
            data: { source_type: string; source_id: string };
          };

          expect(createCallArg.data.source_type).toBe(sourceType);
          expect(createCallArg.data.source_id).toBe(sourceId);
        },
      ),
      { numRuns: 100 },
    );
  }, 180_000);
});

// ---------------------------------------------------------------------------
// Property 7: Non-SVG upload populates all three URL fields
// ---------------------------------------------------------------------------

describe('Feature: image-multi-size-upload, Property 7: Non-SVG upload populates all three URL fields', () => {
  /**
   * Validates: Requirements 3.1, 3.6
   *
   * For any non-SVG image upload (image/jpeg or image/png), the persisted
   * MediaAsset SHALL have url_original, url_medium, and url_small all set
   * to non-empty strings.
   */

  const FIXED_ENTITY_ID = '00000000-0000-4000-8000-000000000001';
  const FIXED_ASSET_ID = '00000000-0000-4000-8000-000000000002';

  it('url_original, url_medium, and url_small are all non-empty for any non-SVG mime/dimensions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          mime: fc.constantFrom('image/jpeg' as const, 'image/png' as const),
          width: fc.integer({ min: 1, max: 3000 }),
          height: fc.integer({ min: 1, max: 3000 }),
        }),
        async ({ mime, width, height }) => {
          // Build a synthetic image buffer matching the generated dimensions
          const buffer = await sharp({
            create: {
              width,
              height,
              channels: 3,
              background: { r: 100, g: 150, b: 200 },
            },
          })
            .jpeg()
            .toBuffer();

          // Mock PrismaService: entity exists, no existing assets, create returns echoed data
          const mockCreate = jest.fn().mockImplementation(
            ({ data }: { data: Record<string, unknown> }) =>
              Promise.resolve({
                id: FIXED_ASSET_ID,
                source_id: data['source_id'],
                source_type: data['source_type'],
                type: data['type'],
                url_original: data['url_original'],
                url_medium: data['url_medium'] ?? null,
                url_small: data['url_small'] ?? null,
                alt_text: null,
                filename: data['filename'],
                sort_order: data['sort_order'],
                created_at: new Date(),
                updated_at: new Date(),
              }),
          );

          const mockPrisma = {
            entry: {
              findUnique: jest.fn().mockResolvedValue({ id: FIXED_ENTITY_ID }),
            },
            mediaAsset: {
              count: jest.fn().mockResolvedValue(0),
              create: mockCreate,
            },
          } as unknown as PrismaService;

          // Build service and mock S3 (all PutObjectCommands succeed)
          const service = new MediaService(mockPrisma);
          (service as any).s3 = {
            send: jest.fn().mockResolvedValue({}),
          } as unknown as S3Client;

          const mockFile: Express.Multer.File = {
            fieldname: 'file',
            originalname: 'test-image.jpg',
            encoding: '7bit',
            mimetype: mime,
            buffer,
            size: buffer.length,
            stream: null as any,
            destination: '',
            filename: '',
            path: '',
          };

          const result = await service.uploadForEntity('entry', FIXED_ENTITY_ID, mockFile);

          // All three URL fields must be non-empty strings
          expect(typeof result.data.url_original).toBe('string');
          expect(result.data.url_original.length).toBeGreaterThan(0);

          expect(typeof result.data.url_medium).toBe('string');
          expect((result.data.url_medium as string).length).toBeGreaterThan(0);

          expect(typeof result.data.url_small).toBe('string');
          expect((result.data.url_small as string).length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  }, 120_000);
});

// ---------------------------------------------------------------------------
// Property 8: Stored filename matches original uploaded filename
// ---------------------------------------------------------------------------

describe('Feature: image-multi-size-upload, Property 8: Stored filename matches original uploaded filename', () => {
  /**
   * Validates: Requirements 3.3
   *
   * For any uploaded file with a given `originalname`, the created
   * MediaAsset.filename SHALL equal that original filename (truncated to
   * 255 characters if longer).
   */

  const FIXED_ENTITY_ID = '00000000-0000-4000-8000-000000000010';
  const FIXED_ASSET_ID = '00000000-0000-4000-8000-000000000011';

  /** Shared tiny PNG buffer — created once and reused across all iterations. */
  let pngBuffer: Buffer;

  beforeAll(async () => {
    pngBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 100, g: 150, b: 200 },
      },
    })
      .png()
      .toBuffer();
  });

  function buildMocks(originalname: string) {
    const mockCreate = jest.fn().mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: FIXED_ASSET_ID,
          source_id: data['source_id'],
          source_type: data['source_type'],
          type: data['type'],
          url_original: data['url_original'],
          url_medium: data['url_medium'] ?? null,
          url_small: data['url_small'] ?? null,
          alt_text: null,
          filename: data['filename'],
          sort_order: data['sort_order'],
          created_at: new Date(),
          updated_at: new Date(),
        }),
    );

    const mockPrisma = {
      entry: {
        findUnique: jest.fn().mockResolvedValue({ id: FIXED_ENTITY_ID }),
      },
      mediaAsset: {
        count: jest.fn().mockResolvedValue(0),
        create: mockCreate,
      },
    } as unknown as PrismaService;

    const service = new MediaService(mockPrisma);
    (service as any).s3 = {
      send: jest.fn().mockResolvedValue({}),
    } as unknown as S3Client;

    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname,
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: pngBuffer,
      size: pngBuffer.length,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    return { service, mockCreate, mockFile };
  }

  it('filename is preserved exactly for filenames within the 255-char limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 255 }),
        async (originalname) => {
          const { service, mockCreate, mockFile } = buildMocks(originalname);

          await service.uploadForEntity('entry', FIXED_ENTITY_ID, mockFile);

          expect(mockCreate).toHaveBeenCalledTimes(1);
          const createArg = mockCreate.mock.calls[0][0] as {
            data: { filename: string };
          };
          // filename ≤ 255 chars — must be stored verbatim
          expect(createArg.data.filename).toBe(originalname.slice(0, 255));
        },
      ),
      { numRuns: 100 },
    );
  }, 120_000);

  it('filename is truncated to 255 characters when originalname exceeds the limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 256, maxLength: 512 }),
        async (originalname) => {
          const { service, mockCreate, mockFile } = buildMocks(originalname);

          await service.uploadForEntity('entry', FIXED_ENTITY_ID, mockFile);

          expect(mockCreate).toHaveBeenCalledTimes(1);
          const createArg = mockCreate.mock.calls[0][0] as {
            data: { filename: string };
          };
          // Filename must be truncated to exactly 255 chars
          expect(createArg.data.filename).toBe(originalname.slice(0, 255));
          expect(createArg.data.filename.length).toBe(255);
        },
      ),
      { numRuns: 100 },
    );
  }, 120_000);
});
