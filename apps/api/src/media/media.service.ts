import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';

export interface MediaAssetDto {
  id: string;
  source_id: string;
  source_type: string;
  type: string;
  url_original: string;
  url_medium: string | null;
  url_small: string | null;
  alt_text: string | null;
  filename: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const ALLOWED_VIDEO_TYPES = ['video/mp4'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

// Editor image upload (no entry association)
const EDITOR_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const EDITOR_MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

interface ResizeResult {
  buffer: Buffer;
  contentType: string;
  ext: string;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly prisma: PrismaService) {
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID ?? ''}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
    });
    this.bucket = process.env.R2_BUCKET_NAME ?? 'knitting-media';
    this.publicUrl = process.env.R2_PUBLIC_URL ?? 'https://media.knitting.example.com';
  }

  async uploadEditorImage(
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!EDITOR_IMAGE_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: jpeg, png, gif, webp`,
      );
    }
    if (file.size > EDITOR_MAX_IMAGE_SIZE) {
      throw new BadRequestException('File too large. Maximum size: 10MB');
    }

    const ext = extname(file.originalname).toLowerCase() || '.bin';
    const key = `images/${randomUUID()}${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }),
    );

    return { url: `${this.publicUrl}/${key}` };
  }

  async upload(
    entryId: string,
    file: Express.Multer.File,
  ): Promise<{ data: { url: string; asset_id: string } }> {
    // Validate entry exists
    const entry = await this.prisma.entry.findUnique({
      where: { id: entryId },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException(`Entry ${entryId} not found`);

    // Validate file type
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.mimetype);
    if (!isImage && !isVideo) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: jpeg, png, webp, svg, mp4`,
      );
    }

    // Validate file size
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      throw new BadRequestException(`File too large. Maximum size: ${maxMB}MB`);
    }

    // Generate unique key
    const ext = extname(file.originalname).toLowerCase();
    const key = `entries/${entryId}/${randomUUID()}${ext}`;

    // Upload to R2
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }),
    );

    const url = `${this.publicUrl}/${key}`;

    // Determine MediaType
    let mediaType: 'image' | 'diagram' | 'video_clip' | 'chart' = 'image';
    if (isVideo) mediaType = 'video_clip';
    else if (file.mimetype === 'image/svg+xml') mediaType = 'diagram';

    // Insert MediaAsset row (using polymorphic fields; entry_id/url columns dropped)
    const asset = await this.prisma.mediaAsset.create({
      data: {
        source_id: entryId,
        source_type: 'entry',
        type: mediaType,
        url_original: url,
        filename: file.originalname.slice(0, 255),
        sort_order: 0,
      },
    });

    return { data: { url, asset_id: asset.id } };
  }

  async uploadForEntity(
    sourceType: 'entry' | 'article',
    sourceId: string,
    file: Express.Multer.File,
  ): Promise<{ data: MediaAssetDto }> {
    // 1. Validate file type and size first (before any DB/R2 call)
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: jpeg, png, webp, svg`,
      );
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException(`File too large. Maximum size: ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`);
    }

    // 2. Verify entity existence
    if (sourceType === 'entry') {
      const entry = await this.prisma.entry.findUnique({
        where: { id: sourceId },
        select: { id: true },
      });
      if (!entry) throw new NotFoundException(`Entry ${sourceId} not found`);
    } else {
      const article = await this.prisma.article.findUnique({
        where: { id: sourceId },
        select: { id: true },
      });
      if (!article) throw new NotFoundException(`Article ${sourceId} not found`);
    }

    const isSvg = file.mimetype === 'image/svg+xml';
    const mediaType: 'image' | 'diagram' = isSvg ? 'diagram' : 'image';
    const uuid = randomUUID();
    const origExt = extname(file.originalname).toLowerCase() || '.bin';

    // 3. Build variants list
    interface Variant {
      key: string;
      buffer: Buffer;
      contentType: string;
      size: 'original' | 'medium' | 'small';
    }

    const variants: Variant[] = [];

    // Original variant always included
    variants.push({
      key: `${sourceType}/${sourceId}/${uuid}/original${origExt}`,
      buffer: file.buffer,
      contentType: file.mimetype,
      size: 'original',
    });

    if (!isSvg) {
      const mediumResult = await this.resizeVariant(file.buffer, 800);
      variants.push({
        key: `${sourceType}/${sourceId}/${uuid}/medium.webp`,
        buffer: mediumResult.buffer,
        contentType: mediumResult.contentType,
        size: 'medium',
      });

      const smallResult = await this.resizeVariant(file.buffer, 300);
      variants.push({
        key: `${sourceType}/${sourceId}/${uuid}/small.webp`,
        buffer: smallResult.buffer,
        contentType: smallResult.contentType,
        size: 'small',
      });
    }

    // 4. Upload each variant to R2; cleanup on failure
    const uploadedKeys: string[] = [];
    try {
      for (const variant of variants) {
        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: variant.key,
            Body: variant.buffer,
            ContentType: variant.contentType,
            ContentLength: variant.buffer.length,
          }),
        );
        uploadedKeys.push(variant.key);
      }
    } catch {
      // Best-effort cleanup of already-uploaded variants
      await Promise.allSettled(
        uploadedKeys.map((key) =>
          this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })),
        ),
      );
      throw new InternalServerErrorException(
        'Upload failed; partial uploads have been cleaned up',
      );
    }

    // 5. Build public URLs
    const urlOriginal = `${this.publicUrl}/${variants[0].key}`;
    const urlMedium = !isSvg && variants[1] ? `${this.publicUrl}/${variants[1].key}` : null;
    const urlSmall = !isSvg && variants[2] ? `${this.publicUrl}/${variants[2].key}` : null;

    // 6. Determine sort_order (count existing assets for this entity)
    const existingCount = await this.prisma.mediaAsset.count({
      where: { source_type: sourceType, source_id: sourceId },
    });

    // 7. Persist MediaAsset row
    const asset = await this.prisma.mediaAsset.create({
      data: {
        source_id: sourceId,
        source_type: sourceType,
        type: mediaType,
        url_original: urlOriginal,
        url_medium: urlMedium,
        url_small: urlSmall,
        filename: file.originalname.slice(0, 255),
        sort_order: existingCount,
      },
    });

    return {
      data: {
        id: asset.id,
        source_id: asset.source_id,
        source_type: asset.source_type,
        type: asset.type,
        url_original: asset.url_original,
        url_medium: asset.url_medium ?? null,
        url_small: asset.url_small ?? null,
        alt_text: asset.alt_text ?? null,
        filename: asset.filename,
        sort_order: asset.sort_order,
        created_at: asset.created_at.toISOString(),
        updated_at: asset.updated_at.toISOString(),
      },
    };
  }

  private async resizeVariant(
    input: Buffer,
    maxEdge: number,
  ): Promise<ResizeResult> {
    const resized = await sharp(input)
      .resize(maxEdge, maxEdge, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
    return { buffer: resized, contentType: 'image/webp', ext: '.webp' };
  }

  async updateAltText(
    assetId: string,
    altText: string | null | undefined,
  ): Promise<MediaAssetDto> {
    // 1. Look up the asset
    const existing = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
    });
    if (!existing) {
      throw new NotFoundException(`MediaAsset ${assetId} not found`);
    }

    // 2. Validate length if a string was provided
    if (typeof altText === 'string' && altText.length > 500) {
      throw new BadRequestException('alt_text must not exceed 500 characters');
    }

    // 3. If altText is undefined (key absent from body), return existing record unchanged
    if (altText === undefined) {
      return {
        id: existing.id,
        source_id: existing.source_id,
        source_type: existing.source_type,
        type: existing.type,
        url_original: existing.url_original,
        url_medium: existing.url_medium ?? null,
        url_small: existing.url_small ?? null,
        alt_text: existing.alt_text ?? null,
        filename: existing.filename,
        sort_order: existing.sort_order,
        created_at: existing.created_at.toISOString(),
        updated_at: existing.updated_at.toISOString(),
      };
    }

    // 4. Update alt_text
    const updated = await this.prisma.mediaAsset.update({
      where: { id: assetId },
      data: { alt_text: altText },
    });

    return {
      id: updated.id,
      source_id: updated.source_id,
      source_type: updated.source_type,
      type: updated.type,
      url_original: updated.url_original,
      url_medium: updated.url_medium ?? null,
      url_small: updated.url_small ?? null,
      alt_text: updated.alt_text ?? null,
      filename: updated.filename,
      sort_order: updated.sort_order,
      created_at: updated.created_at.toISOString(),
      updated_at: updated.updated_at.toISOString(),
    };
  }

  async listForEntity(
    sourceType: 'entry' | 'article',
    sourceId: string,
  ): Promise<MediaAssetDto[]> {
    const assets = await this.prisma.mediaAsset.findMany({
      where: {
        source_type: sourceType,
        source_id: sourceId,
      },
      orderBy: [
        { sort_order: 'asc' },
        { created_at: 'asc' },
      ],
    });

    return assets.map((asset) => ({
      id: asset.id,
      source_id: asset.source_id,
      source_type: asset.source_type,
      type: asset.type,
      url_original: asset.url_original,
      url_medium: asset.url_medium ?? null,
      url_small: asset.url_small ?? null,
      alt_text: asset.alt_text ?? null,
      filename: asset.filename,
      sort_order: asset.sort_order,
      created_at: asset.created_at.toISOString(),
      updated_at: asset.updated_at.toISOString(),
    }));
  }

  async deleteAssetsForEntity(
    sourceType: 'entry' | 'article',
    sourceId: string,
  ): Promise<void> {
    const assets = await this.prisma.mediaAsset.findMany({
      where: { source_type: sourceType, source_id: sourceId },
    });

    const deletePromises: Promise<unknown>[] = [];
    const keys: string[] = [];

    for (const asset of assets) {
      for (const url of [asset.url_original, asset.url_medium, asset.url_small]) {
        if (url) {
          const key = url.replace(`${this.publicUrl}/`, '');
          keys.push(key);
          deletePromises.push(
            this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })),
          );
        }
      }
    }

    const results = await Promise.allSettled(deletePromises);
    for (const [i, result] of results.entries()) {
      if (result.status === 'rejected') {
        this.logger.error(`Failed to delete R2 object ${keys[i]}: ${result.reason}`);
      }
    }

    await this.prisma.mediaAsset.deleteMany({
      where: { source_type: sourceType, source_id: sourceId },
    });
  }
}
