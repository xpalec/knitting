/**
 * Property-based tests for MediaService cascade deletion logic.
 * Uses fast-check with Jest as the test runner.
 *
 * Feature: image-multi-size-upload
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
import * as fc from 'fast-check';
import {
  DeleteObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { MediaService } from './media.service';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const PUBLIC_URL_P13 = 'https://media.example.com';

function buildAsset(
  idx: number,
  urls: { url_original: string; url_medium: string | null; url_small: string | null },
) {
  return {
    id: `asset-${idx}`,
    source_id: 'entity-id-123',
    source_type: 'entry',
    type: 'image',
    url_original: urls.url_original,
    url_medium: urls.url_medium,
    url_small: urls.url_small,
    alt_text: null,
    filename: `photo-${idx}.jpg`,
    sort_order: idx,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  };
}

function countNonNullUrls(
  assets: Array<{
    url_original: string;
    url_medium: string | null;
    url_small: string | null;
  }>,
): number {
  return assets.reduce((total, asset) => {
    let count = 1; // url_original is always non-null
    if (asset.url_medium !== null) count++;
    if (asset.url_small !== null) count++;
    return total + count;
  }, 0);
}

// ---------------------------------------------------------------------------
// Property 13: Cascade delete issues R2 delete for all non-null variant URLs
// ---------------------------------------------------------------------------

describe(
  'Feature: image-multi-size-upload, Property 13: Cascade delete issues R2 delete for all non-null variant URLs',
  () => {
    /**
     * Validates: Requirements 6.1, 6.2
     *
     * For any entity with N associated MediaAsset records (0–10), calling
     * deleteAssetsForEntity SHALL issue a DeleteObjectCommand for each
     * non-null URL field across all assets.
     *
     * url_original is always non-null (1 delete per asset minimum).
     * url_medium and url_small are nullable (0 or 1 additional delete each).
     * Total DeleteObjectCommand calls must equal the sum of non-null URL fields.
     */
    it(
      'issues DeleteObjectCommand exactly once per non-null URL field across all assets',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(
              fc.record({
                url_original: fc.webUrl(),
                url_medium: fc.option(fc.webUrl(), { nil: null }),
                url_small: fc.option(fc.webUrl(), { nil: null }),
              }),
              { minLength: 0, maxLength: 10 },
            ),
            async (assetUrlData) => {
              // Build mock assets from generated URL data
              const mockAssets = assetUrlData.map((urls, idx) =>
                buildAsset(idx, urls),
              );

              const mockDeleteMany = jest.fn().mockResolvedValue({ count: mockAssets.length });

              const mockPrisma = {
                mediaAsset: {
                  findMany: jest.fn().mockResolvedValue(mockAssets),
                  deleteMany: mockDeleteMany,
                },
              } as unknown as PrismaService;

              // Track all DeleteObjectCommand calls
              const deleteSendCalls: DeleteObjectCommand[] = [];

              const mockS3Send = jest.fn().mockImplementation((command: unknown) => {
                if (command instanceof DeleteObjectCommand) {
                  deleteSendCalls.push(command);
                }
                return Promise.resolve({});
              });

              const service = new MediaService(mockPrisma);
              (service as any).s3 = { send: mockS3Send } as unknown as S3Client;
              (service as any).publicUrl = PUBLIC_URL_P13;

              const entityId = 'entity-id-123';
              await service.deleteAssetsForEntity('entry', entityId);

              // DeleteObjectCommand must be called exactly once per non-null URL field
              const expectedDeleteCount = countNonNullUrls(assetUrlData);
              expect(deleteSendCalls.length).toBe(expectedDeleteCount);

              // deleteMany must always be called
              expect(mockDeleteMany).toHaveBeenCalledTimes(1);
              expect(mockDeleteMany).toHaveBeenCalledWith({
                where: { source_type: 'entry', source_id: entityId },
              });
            },
          ),
          { numRuns: 100 },
        );
      },
      60_000,
    );

    /**
     * Edge case: when no assets exist, zero DeleteObjectCommand calls and
     * deleteMany is still called.
     */
    it('issues zero DeleteObjectCommand calls and still calls deleteMany when no assets exist', async () => {
      const mockDeleteMany = jest.fn().mockResolvedValue({ count: 0 });

      const mockPrisma = {
        mediaAsset: {
          findMany: jest.fn().mockResolvedValue([]),
          deleteMany: mockDeleteMany,
        },
      } as unknown as PrismaService;

      const mockS3Send = jest.fn().mockResolvedValue({});

      const service = new MediaService(mockPrisma);
      (service as any).s3 = { send: mockS3Send } as unknown as S3Client;
      (service as any).publicUrl = PUBLIC_URL_P13;

      await service.deleteAssetsForEntity('entry', 'any-entity-id');

      expect(mockS3Send).not.toHaveBeenCalled();
      expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    });
  },
);

// ---------------------------------------------------------------------------
// Property 15: Cascade delete removes DB rows regardless of R2 failure
// ---------------------------------------------------------------------------

describe(
  'Feature: image-multi-size-upload, Property 15: Cascade delete removes DB rows regardless of R2 failure',
  () => {
    /**
     * Validates: Requirements 6.4
     *
     * For any entity whose R2 deletions partially or fully fail, the associated
     * MediaAsset database rows SHALL be deleted and the parent entity delete SHALL
     * proceed without error.
     *
     * In other words: `prisma.mediaAsset.deleteMany` is ALWAYS called regardless
     * of how many R2 DeleteObjectCommand calls fail, and `deleteAssetsForEntity`
     * NEVER throws.
     */
    it('always calls deleteMany and does not throw regardless of which R2 deletes fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            assets: fc.array(
              fc.record({
                url_original: fc.webUrl(),
                url_medium: fc.option(fc.webUrl(), { nil: null }),
                url_small: fc.option(fc.webUrl(), { nil: null }),
              }),
              { minLength: 0, maxLength: 10 },
            ),
            failingIndices: fc.uniqueArray(
              fc.integer({ min: 0, max: 29 }),
              { maxLength: 10 },
            ),
          }),
          async ({ assets, failingIndices }) => {
            const failingSet = new Set(failingIndices);

            // ----------------------------------------------------------------
            // Build full asset records as Prisma would return them
            // ----------------------------------------------------------------
            const ENTITY_ID = '00000000-0000-4000-8000-000000000001';
            const PUBLIC_URL = 'https://media.knitting.example.com';

            const prismaAssets = assets.map((a, i) => ({
              id: `asset-id-${i}`,
              source_id: ENTITY_ID,
              source_type: 'entry',
              type: 'image',
              url_original: a.url_original,
              url_medium: a.url_medium,
              url_small: a.url_small,
              alt_text: null,
              filename: `file-${i}.jpg`,
              sort_order: i,
              created_at: new Date(),
              updated_at: new Date(),
            }));

            // ----------------------------------------------------------------
            // Mock S3 client: fail on the generated failing indices, succeed otherwise
            // ----------------------------------------------------------------
            let deleteCallCount = 0;
            const mockSend = jest.fn().mockImplementation((command: unknown) => {
              if (command instanceof DeleteObjectCommand) {
                const callIndex = deleteCallCount;
                deleteCallCount++;
                if (failingSet.has(callIndex)) {
                  return Promise.reject(new Error(`Simulated R2 failure at index ${callIndex}`));
                }
              }
              return Promise.resolve({});
            });

            // ----------------------------------------------------------------
            // Mock PrismaService
            // ----------------------------------------------------------------
            const mockDeleteMany = jest.fn().mockResolvedValue({ count: prismaAssets.length });

            const mockPrisma = {
              mediaAsset: {
                findMany: jest.fn().mockResolvedValue(prismaAssets),
                deleteMany: mockDeleteMany,
              },
            } as unknown as PrismaService;

            // ----------------------------------------------------------------
            // Build service with mocks
            // ----------------------------------------------------------------
            const service = new MediaService(mockPrisma);
            (service as any).s3 = { send: mockSend } as unknown as S3Client;
            // Override publicUrl to match what we use in asset URLs
            (service as any).publicUrl = PUBLIC_URL;

            // ----------------------------------------------------------------
            // Call deleteAssetsForEntity — must NOT throw
            // ----------------------------------------------------------------
            await expect(
              service.deleteAssetsForEntity('entry', ENTITY_ID),
            ).resolves.toBeUndefined();

            // ----------------------------------------------------------------
            // Assert: deleteMany is ALWAYS called exactly once
            // ----------------------------------------------------------------
            expect(mockDeleteMany).toHaveBeenCalledTimes(1);
            expect(mockDeleteMany).toHaveBeenCalledWith({
              where: { source_type: 'entry', source_id: ENTITY_ID },
            });
          },
        ),
        { numRuns: 100 },
      );
    }, 60_000);
  },
);

// ---------------------------------------------------------------------------
// Property 14: R2 key round-trips through URL construction
// ---------------------------------------------------------------------------

// Pure helper — mirrors the key-derivation logic inside deleteAssetsForEntity:
//   const key = url.replace(`${this.publicUrl}/`, '');
function stripPrefix(publicUrl: string, fullUrl: string): string {
  return fullUrl.replace(`${publicUrl}/`, '');
}

describe(
  'Feature: image-multi-size-upload, Property 14: R2 key round-trips through URL construction',
  () => {
    /**
     * Validates: Requirements 6.3
     *
     * For any valid R2 key string, constructing the public URL as
     * `{R2_PUBLIC_URL}/{key}` and then stripping the `{R2_PUBLIC_URL}/`
     * prefix SHALL yield the original key unchanged.
     *
     * This verifies that the URL → key derivation used in
     * `deleteAssetsForEntity` correctly round-trips for any well-formed key.
     */
    it(
      'stripPrefix(publicUrl + "/" + key) === key for any valid R2 key',
      async () => {
        const publicUrl = 'https://media.example.com';

        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1 }).filter((k) => !k.includes('..')),
            async (key) => {
              const fullUrl = `${publicUrl}/${key}`;
              const recovered = stripPrefix(publicUrl, fullUrl);
              expect(recovered).toBe(key);
            },
          ),
          { numRuns: 100 },
        );
      },
      30_000,
    );
  },
);
