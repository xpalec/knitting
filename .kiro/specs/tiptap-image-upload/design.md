# Design Document

## Overview

This document describes the architecture and implementation plan for adding persistent image upload to the Tiptap editor in `apps/admin`. The current implementation uses temporary `blob:` URLs that disappear when the page is refreshed. This feature replaces that approach with a proper upload pipeline: the `Image.configure({ upload })` callback sends the file to a new Next.js API route (`POST /api/image-upload`), which validates and stores the file in Cloudflare R2, then returns a permanent public CDN URL that Tiptap embeds in the document.

The change touches two files and adds one new file:

| File | Change |
|---|---|
| `apps/admin/src/components/Editor/Editor.tsx` | Replace the stub `upload` function on `Image.configure()` with a real `uploadImage` helper |
| `apps/admin/src/app/api/image-upload/route.ts` | New Next.js route handler — validation + R2 upload |
| `apps/admin/.env.example` | Add the five R2 environment variable keys |

---

## Architecture

```
Browser (Editor.tsx)
  └─ Image toolbar button
       └─ File picker (client-side MIME + size validation)
            └─ uploadImage(file) → POST /api/image-upload
                                         │
                              Next.js Route Handler
                              (server-side validation)
                                         │
                              @aws-sdk/client-s3
                              PutObjectCommand
                                         │
                              Cloudflare R2
                                         │
                              ← { url: "https://cdn.example.com/images/<uuid>.<ext>" }
```

### Data Flow

1. User clicks the image toolbar button in the editor.
2. `reactjs-tiptap-editor` opens a file picker; the `upload` callback receives the selected `File`.
3. The `uploadImage` helper validates MIME type and size client-side; invalid files are rejected with a toast and a thrown error.
4. A `multipart/form-data` `POST` request is sent to `/api/image-upload` with the file under the `"file"` field.
5. The server validates the file again (MIME type, size) and checks all required environment variables.
6. The server calls `PutObjectCommand` via `@aws-sdk/client-s3` to upload the file to Cloudflare R2.
7. On success the server returns `{ "url": "<R2_PUBLIC_URL>/images/<uuid>.<ext>" }`.
8. `uploadImage` resolves with the URL string; Tiptap inserts a permanent `<img src>` into the document.

### Dependency

`@aws-sdk/client-s3` is not yet in `apps/admin/package.json` and must be added:

```
pnpm add @aws-sdk/client-s3 --filter admin
```

No other new dependencies are required. `sonner` (for toasts) and `crypto`/`path` (Node.js built-ins) are already available.

---

## Components and Interfaces

### 1. `uploadImage` helper (`Editor.tsx`)

The existing `Image.configure({ upload: ... })` stub is replaced with an async function defined in `Editor.tsx`.

**Shared constants** (used by both client helper and server route):

```typescript
const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
```

**`uploadImage` function:**

```typescript
async function uploadImage(file: File): Promise<string> {
  // Client-side pre-validation (Requirements 1.2 & 1.3)
  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    toast.error('Unsupported image type. Please use JPEG, PNG, GIF, or WebP.');
    throw new Error('Unsupported file type');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    toast.error('Image is too large. Maximum size is 10 MB.');
    throw new Error('File too large');
  }

  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/api/image-upload', {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    toast.error((body as { error?: string }).error ?? 'Image upload failed.');
    throw new Error('Upload failed');
  }

  const { url } = (await res.json()) as { url: string };
  return url;
}
```

Wire it into the extension config:

```typescript
Image.configure({
  HTMLAttributes: { class: 'content-image' },
  upload: uploadImage,
}),
```

The `reactjs-tiptap-editor` `Image` extension renders a loading placeholder while the `upload` promise is pending (satisfies Requirement 2.4 with no additional code).

`toast` from `sonner` must be imported at the top of `Editor.tsx`.

---

### 2. Route handler (`apps/admin/src/app/api/image-upload/route.ts`)

Follows the Next.js App Router Route Handler pattern used by `apps/admin/src/app/api/auth/session/route.ts`.

**Required environment variables:**

| Variable | Purpose |
|---|---|
| `R2_ACCOUNT_ID` | Used to construct the S3-compatible endpoint URL |
| `R2_ACCESS_KEY_ID` | R2 API key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API secret key |
| `R2_BUCKET_NAME` | Target R2 bucket |
| `R2_PUBLIC_URL` | Public CDN base URL (e.g. `https://pub-abc.r2.dev`) |

**Processing sequence:**

1. Check all required env vars are present; return `500` if any are missing.
2. Parse `request.formData()` and extract the `file` field.
3. Return `400 { "error": "No file provided" }` if `file` is absent or not a `File` instance.
4. Return `400 { "error": "Unsupported file type" }` if `file.type` is not in the accepted set.
5. Return `400 { "error": "File too large" }` if `file.size > 10 MB`.
6. Generate key: `images/<crypto.randomUUID()>.<ext>` where `ext` is derived from `path.extname(file.name)`.
7. Instantiate `S3Client` with endpoint `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`.
8. Call `PutObjectCommand`; return `500 { "error": "Upload failed" }` (and `console.error`) on failure.
9. Return `200 { "url": "${R2_PUBLIC_URL}/${key}" }`.

**Full implementation:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import path from 'path';

const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const REQUIRED_ENV_VARS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
] as const;

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Environment validation
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const accountId = process.env.R2_ACCOUNT_ID!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
  const bucketName = process.env.R2_BUCKET_NAME!;
  const publicUrl = process.env.R2_PUBLIC_URL!;

  // 2 & 3. Parse form data
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // 4. MIME type validation
  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  // 5. Size validation
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large' }, { status: 400 });
  }

  // 6. Generate unique object key
  const ext = path.extname(file.name).toLowerCase() || '.bin';
  const key = `images/${randomUUID()}${ext}`;

  // 7. Upload to R2
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const arrayBuffer = await file.arrayBuffer();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: Buffer.from(arrayBuffer),
        ContentType: file.type,
      }),
    );
  } catch (err) {
    console.error('[image-upload] R2 PutObject failed:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  // 8. Return public URL
  return NextResponse.json({ url: `${publicUrl}/${key}` }, { status: 200 });
}
```

---

## Data Models

### 3. Request and Response Shapes

**Request (multipart/form-data)**

| Field | Type | Description |
|---|---|---|
| `file` | `File` | The image file to upload |

**Success Response (200)**

```typescript
interface UploadSuccessResponse {
  url: string; // e.g. "https://pub-abc.r2.dev/images/550e8400-...-440000.jpg"
}
```

**Error Response (400 / 500)**

```typescript
interface UploadErrorResponse {
  error: string; // human-readable error message
}
```

**Object Key Format**

```
images/<uuid-v4>.<lowercase-extension>
```

Example: `images/550e8400-e29b-41d4-a716-446655440000.jpg`

---

### 4. Environment Configuration (`.env.example`)

The following keys are appended to `apps/admin/.env.example`:

```dotenv
# Cloudflare R2 — image upload
R2_ACCOUNT_ID=<your-cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_BUCKET_NAME=<r2-bucket-name>
R2_PUBLIC_URL=https://pub-<hash>.r2.dev
```

---

## Error Handling

| Condition | Layer | HTTP Status | Client Behavior |
|---|---|---|---|
| Invalid MIME type (client) | Client | — | Toast error; promise rejected; no network request |
| File > 10 MB (client) | Client | — | Toast error; promise rejected; no network request |
| Upload route non-2xx | Client | — | Toast error (uses `error` from body if present); promise rejected |
| No `file` field in form | Server | 400 | `{ "error": "No file provided" }` |
| Invalid MIME type (server) | Server | 400 | `{ "error": "Unsupported file type" }` |
| File > 10 MB (server) | Server | 400 | `{ "error": "File too large" }` |
| Missing env var | Server | 500 | `{ "error": "Server misconfiguration" }` |
| R2 `PutObjectCommand` throws | Server | 500 | `{ "error": "Upload failed" }` + `console.error` |

Both client and server perform independent validation, so the system degrades gracefully if one layer is bypassed.

---

## Testing Strategy

Tests live alongside the source files in `apps/admin` and are run with `vitest --run`.

**Unit / property tests** cover the pure logic in both the client helper and the server route handler. The server route is tested with a mocked `@aws-sdk/client-s3` and mocked environment variables.

**Integration tests** (manual or CI end-to-end) verify the R2 wiring with real credentials.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Invalid MIME types are always rejected client-side

*For any* `File` object whose `type` is not one of `image/jpeg`, `image/png`, `image/gif`, or `image/webp`, the `uploadImage` function shall throw an error (rejecting the promise) without making any network request.

**Validates: Requirements 1.3**

---

### Property 2: Oversized files are always rejected client-side

*For any* `File` object whose `size` is strictly greater than 10,485,760 bytes (10 MB), the `uploadImage` function shall throw an error (rejecting the promise) without making any network request.

**Validates: Requirements 1.2**

---

### Property 3: Upload callback sends the file under the correct field name

*For any* valid `File` object (accepted MIME type, size ≤ 10 MB), calling `uploadImage(file)` shall result in a `POST` to `/api/image-upload` whose `FormData` body contains the file under the field name `"file"`.

**Validates: Requirements 2.1**

---

### Property 4: Success response URL is returned verbatim

*For any* URL string `u` returned in a `200` response body `{ "url": u }`, the `uploadImage(file)` promise shall resolve to exactly `u` with no transformation.

**Validates: Requirements 2.2**

---

### Property 5: Any non-200 HTTP status rejects the upload callback

*For any* HTTP status code that is not `200`, a response from the upload route shall cause the `uploadImage` promise to reject and trigger an error toast notification.

**Validates: Requirements 2.3**

---

### Property 6: Server rejects any non-accepted MIME type with 400

*For any* MIME type string not in `{ "image/jpeg", "image/png", "image/gif", "image/webp" }`, a `POST` request to `/api/image-upload` containing a file with that MIME type shall return HTTP `400` with body `{ "error": "Unsupported file type" }`.

**Validates: Requirements 3.2**

---

### Property 7: Server rejects oversized files with 400

*For any* file whose `size` exceeds 10,485,760 bytes, a `POST` to `/api/image-upload` shall return HTTP `400` with body `{ "error": "File too large" }`.

**Validates: Requirements 3.3**

---

### Property 8: Valid files always reach R2

*For any* file with an accepted MIME type and `size` ≤ 10 MB, when all required environment variables are present, a `POST` to `/api/image-upload` shall invoke `PutObjectCommand` exactly once with the correct `Bucket`, `Key`, `Body`, and `ContentType`.

**Validates: Requirements 3.4, 4.2**

---

### Property 9: Object key always matches the expected pattern

*For any* original filename with a recognized extension, the generated object key shall match the regex `^images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]+$`.

**Validates: Requirements 4.1**

---

### Property 10: Public URL is correctly constructed from env var and key

*For any* value of `R2_PUBLIC_URL` and any generated object key `k`, the response `url` field shall equal `${R2_PUBLIC_URL}/${k}` (exact string concatenation with a single `/` separator).

**Validates: Requirements 4.3**

---

### Property 11: Any missing required environment variable triggers 500

*For any* non-empty subset of `{ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL }` that is absent from the environment, a `POST` to `/api/image-upload` shall return HTTP `500` with body `{ "error": "Server misconfiguration" }`.

**Validates: Requirements 5.2**

---

### Property 12: R2 endpoint URL is constructed from R2_ACCOUNT_ID

*For any* `R2_ACCOUNT_ID` string `id`, the S3 client used by the upload route shall be configured with endpoint `https://${id}.r2.cloudflarestorage.com`.

**Validates: Requirements 5.3**
