/**
 * Property-based tests for MediaService alt text logic.
 * Uses fast-check with Jest as the test runner.
 *
 * Feature: image-multi-size-upload
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
import * as fc from 'fast-check';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { MediaService } from './media.service';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXED_ASSET_ID = '00000000-0000-4000-8000-000000000099';

/**
 * Builds a mock PrismaService where:
 *   - mediaAsset.findUnique returns a valid asset record
 *   - mediaAsset.update echoes back the asset with the new alt_text applied
 */
function buildMocksWithValidAsset() {
  const baseAsset = {
    id: FIXED_ASSET_ID,
    source_id: '11111111-2222-3333-4444-555555555555',
    source_type: 'entry',
    type: 'image',
    url_original: 'https://media.example.com/entry/123/uuid/original.jpg',
    url_medium: 'https://media.example.com/entry/123/uuid/medium.webp',
    url_small: 'https://media.example.com/entry/123/uuid/small.webp',
    alt_text: null,
    filename: 'photo.jpg',
    sort_order: 0,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  };

  // update echoes back the asset with the submitted alt_text
  const mockUpdate = jest
    .fn()
    .mockImplementation(
      ({ data }: { where: { id: string }; data: { alt_text: string | null } }) =>
        Promise.resolve({ ...baseAsset, alt_text: data.alt_text }),
    );

  const mockPrisma = {
    mediaAsset: {
      findUnique: jest.fn().mockResolvedValue(baseAsset),
      update: mockUpdate,
    },
  } as unknown as PrismaService;

  const service = new MediaService(mockPrisma);
  (service as any).s3 = { send: jest.fn() } as unknown as S3Client;

  return { service, mockPrisma, mockUpdate };
}

// ---------------------------------------------------------------------------
// Property 9: Alt text update accepts all values in valid range
// ---------------------------------------------------------------------------

describe(
  'Feature: image-multi-size-upload, Property 9: Alt text update accepts all values in valid range',
  () => {
    /**
     * Validates: Requirements 4.1, 4.2
     *
     * For any alt_text value that is either null or a string of length 0–500
     * characters, calling updateAltText SHALL:
     *   1. Not throw an exception.
     *   2. Return a MediaAssetDto whose alt_text equals the submitted value.
     *   3. Invoke prisma.mediaAsset.update with the submitted value.
     */
    it('accepts null or any string 0–500 chars and persists the submitted value', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate null OR a string between 0 and 500 characters (inclusive)
          fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: null }),
          async (altText) => {
            const { service, mockUpdate } = buildMocksWithValidAsset();

            // Should not throw for any valid value
            const result = await service.updateAltText(FIXED_ASSET_ID, altText);

            // Returned DTO alt_text must equal the submitted value
            expect(result.alt_text).toBe(altText);

            // The DB update must have been called once with the correct value
            expect(mockUpdate).toHaveBeenCalledTimes(1);
            const updateArg = mockUpdate.mock.calls[0][0] as {
              where: { id: string };
              data: { alt_text: string | null };
            };
            expect(updateArg.where.id).toBe(FIXED_ASSET_ID);
            expect(updateArg.data.alt_text).toBe(altText);
          },
        ),
        { numRuns: 100 },
      );
    }, 60_000);
  },
);

// ---------------------------------------------------------------------------
// Property 10: Alt text exceeding 500 characters is rejected
// ---------------------------------------------------------------------------

describe('Feature: image-multi-size-upload, Property 10: Alt text exceeding 500 characters is rejected', () => {
  /**
   * Validates: Requirements 4.4
   *
   * For any alt_text string with length > 500 characters, the service SHALL
   * throw a BadRequestException with message "alt_text must not exceed 500
   * characters" WITHOUT calling prisma.mediaAsset.update.
   */
  it('throws BadRequestException and does not call update for any alt text longer than 500 chars', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 501, maxLength: 2000 }),
        async (altText) => {
          const { service, mockUpdate } = buildMocksWithValidAsset();

          // updateAltText must throw BadRequestException
          await expect(
            service.updateAltText(FIXED_ASSET_ID, altText),
          ).rejects.toThrow(BadRequestException);

          // The error message must be the canonical one from the spec
          await expect(
            service.updateAltText(FIXED_ASSET_ID, altText),
          ).rejects.toThrow('alt_text must not exceed 500 characters');

          // prisma.mediaAsset.update must NOT have been called at all
          expect(mockUpdate).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  }, 30_000);
});

// ---------------------------------------------------------------------------
// Property 11: Non-existent asset returns 404 on PATCH
// ---------------------------------------------------------------------------

describe('Feature: image-multi-size-upload, Property 11: Non-existent asset returns 404 on PATCH', () => {
  /**
   * Validates: Requirements 4.3
   *
   * For any UUID that does not correspond to a MediaAsset record, the service
   * SHALL throw NotFoundException with the message "MediaAsset {assetId} not found".
   */
  it('throws NotFoundException with the correct message for any UUID not matching a MediaAsset record', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (nonExistentId) => {
          const mockPrisma = {
            mediaAsset: {
              findUnique: jest.fn().mockResolvedValue(null),
              update: jest.fn(),
            },
          } as unknown as PrismaService;

          const service = new MediaService(mockPrisma);
          (service as any).s3 = { send: jest.fn() } as unknown as S3Client;

          await expect(
            service.updateAltText(nonExistentId, 'some alt text'),
          ).rejects.toThrow(NotFoundException);

          await expect(
            service.updateAltText(nonExistentId, 'some alt text'),
          ).rejects.toThrow(`MediaAsset ${nonExistentId} not found`);
        },
      ),
      { numRuns: 100 },
    );
  }, 30_000);
});

// ---------------------------------------------------------------------------
// Property 11: Non-existent asset returns 404 on PATCH
// ---------------------------------------------------------------------------

describe('Feature: image-multi-size-upload, Property 11: Non-existent asset returns 404 on PATCH', () => {
  /**
   * Validates: Requirements 4.3
   *
   * For any UUID that does not correspond to a MediaAsset record, the PATCH
   * endpoint SHALL return HTTP 404 with message `MediaAsset {assetId} not found`.
   */
  it('throws NotFoundException with the correct message for any UUID not matching a MediaAsset record', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (nonExistentId) => {
          // ----------------------------------------------------------------
          // Mock PrismaService: mediaAsset.findUnique always returns null
          // ----------------------------------------------------------------
          const mockPrisma = {
            mediaAsset: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
          } as unknown as PrismaService;

          // ----------------------------------------------------------------
          // Build service
          // ----------------------------------------------------------------
          const service = new MediaService(mockPrisma);
          // S3 client should never be called for this operation
          (service as any).s3 = {
            send: jest.fn().mockRejectedValue(new Error('S3 should not be called')),
          } as unknown as S3Client;

          // ----------------------------------------------------------------
          // Assert: throws NotFoundException with the correct message
          // ----------------------------------------------------------------
          await expect(
            service.updateAltText(nonExistentId, 'some text'),
          ).rejects.toThrow(`MediaAsset ${nonExistentId} not found`);
        },
      ),
      { numRuns: 100 },
    );
  }, 60_000);
});
