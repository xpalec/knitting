/**
 * Smoke test: verifies that the Sharp native binary resolves and can process
 * a minimal image buffer. Guards against native binary issues in CI.
 *
 * Feature: image-multi-size-upload
 * Requirements: 1.1, 1.2
 */
import sharp from 'sharp';

describe('Sharp native binary smoke test', () => {
  it('should import sharp without errors', () => {
    expect(sharp).toBeDefined();
    expect(typeof sharp).toBe('function');
  });

  it('should process a minimal synthetic image buffer', async () => {
    const buffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
      },
    })
      .png()
      .toBuffer();

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should resize an image and return a WebP buffer', async () => {
    // Create a 200x100 synthetic image then resize to longest edge ≤ 80px
    const source = await sharp({
      create: {
        width: 200,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const resized = await sharp(source)
      .resize(80, 80, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    expect(resized).toBeInstanceOf(Buffer);
    expect(resized.length).toBeGreaterThan(0);

    // Verify the output dimensions respect the longest-edge constraint
    const metadata = await sharp(resized).metadata();
    const longestEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0);
    expect(longestEdge).toBeLessThanOrEqual(80);
    expect(metadata.format).toBe('webp');
  });

  it('should report its version string', () => {
    const versions = sharp.versions;
    expect(versions).toBeDefined();
    expect(typeof versions.vips).toBe('string');
  });
});
