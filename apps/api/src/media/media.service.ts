import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const ALLOWED_VIDEO_TYPES = ['video/mp4'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

@Injectable()
export class MediaService {
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

    // Insert MediaAsset row
    const asset = await this.prisma.mediaAsset.create({
      data: {
        entry_id: entryId,
        type: mediaType,
        url,
        sort_order: 0,
      },
    });

    return { data: { url, asset_id: asset.id } };
  }
}
