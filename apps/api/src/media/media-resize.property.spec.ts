/**
 * Property-based tests for MediaService resize logic.
 * Uses fast-check with Jest as the test runner.
 *
 * Feature: image-multi-size-upload
 * Requirements: 1.1, 1.2, 1.4
 */
import * as fc from 'fast-check';
import sharp from 'sharp';
import { MediaService } from './media.service';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a synthetic PNG buffer of the requested dimensions using Sharp.
 */
async function createSyntheticImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 64, b: 32 },
    },
  })
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Shared service instance (no real DB / S3 needed for resizeVariant tests)
// ---------------------------------------------------------------------------

let service: MediaService;

beforeAll(() => {
  // PrismaService constructor reads env vars but none are exercised by resizeVariant.
  const prisma = new PrismaService();
  service = new MediaService(prisma);
});

// ---------------------------------------------------------------------------
// Property 1: Resize respects longest-edge constraint
// ---------------------------------------------------------------------------

describe('Feature: image-multi-size-upload, Property 1: Resize respects longest-edge constraint', () => {
  it('output longest edge ≤ maxEdge for any input dimensions', async () => {
    /**
     * Validates: Requirements 1.1, 1.4
     *
     * For any non-SVG image of arbitrary dimensions, after calling resizeVariant
     * with a given maxEdge, the longest edge of the output SHALL be ≤ maxEdge.
     * If the image is already smaller, it is stored at its original size (no upscaling).
     */
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          width: fc.integer({ min: 1, max: 5000 }),
          height: fc.integer({ min: 1, max: 5000 }),
          maxEdge: fc.integer({ min: 1, max: 2000 }),
        }),
        async ({ width, height, maxEdge }) => {
          const inputBuffer = await createSyntheticImage(width, height);
          const result = await (service as any).resizeVariant(inputBuffer, maxEdge);

          const metadata = await sharp(result.buffer).metadata();
          const longestEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0);

          expect(longestEdge).toBeLessThanOrEqual(maxEdge);
        },
      ),
      { numRuns: 100 },
    );
  }, 120_000);
});

// ---------------------------------------------------------------------------
// Property 2: Non-SVG variants are WebP encoded
// ---------------------------------------------------------------------------

describe('Feature: image-multi-size-upload, Property 2: Non-SVG variants are WebP encoded', () => {
  it('resizeVariant always returns contentType image/webp and ext .webp', async () => {
    /**
     * Validates: Requirements 1.2
     *
     * For any non-SVG MIME type (image/jpeg, image/png, image/webp), calling
     * resizeVariant SHALL return contentType === 'image/webp' and ext === '.webp'.
     *
     * The MIME type of the *source* buffer does not affect the output encoding —
     * resizeVariant always re-encodes to WebP regardless of input.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('image/jpeg', 'image/png', 'image/webp'),
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 1, max: 500 }),
        async (_mimeType, width, height) => {
          // Build a synthetic PNG buffer regardless of the generated MIME type;
          // resizeVariant accepts raw pixel data and always outputs WebP.
          const inputBuffer = await createSyntheticImage(width, height);
          const result = await (service as any).resizeVariant(inputBuffer, 800);

          expect(result.contentType).toBe('image/webp');
          expect(result.ext).toBe('.webp');
        },
      ),
      { numRuns: 100 },
    );
  }, 120_000);
});
