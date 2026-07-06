# Requirements Document

## Introduction

This feature adds persistent image upload to the Tiptap editor in the Next.js admin app (`apps/admin`). When a user selects an image via the existing toolbar button, the editor's `Image.configure({ upload })` callback sends the file to a new dedicated Next.js API route (`POST /api/image-upload`). That route validates the file and uploads it directly to Cloudflare R2 using the S3-compatible API, then returns a public CDN URL. Tiptap inserts the returned URL as an `<img src>` in the document, replacing the current temporary blob URL approach.

## Glossary

- **Upload Route**: The Next.js API route at `POST /api/image-upload` responsible for receiving, validating, and forwarding image files to R2.
- **R2**: Cloudflare R2 object storage, accessed via the S3-compatible endpoint using `@aws-sdk/client-s3`.
- **Upload Callback**: The `upload` function passed to `Image.configure()` in `Editor.tsx`, responsible for triggering the upload and returning a URL to Tiptap.
- **Public URL**: The publicly accessible CDN URL for the stored object, constructed from `R2_PUBLIC_URL` and the generated object key.
- **Editor**: The `Editor` React component located at `apps/admin/src/components/Editor/Editor.tsx`.
- **Accepted Formats**: JPEG, PNG, GIF, and WebP image files.
- **File Size Limit**: The maximum permitted file size, defaulting to 10 MB.

## Requirements

### Requirement 1: Client-Side File Selection

**User Story:** As an admin editor, I want to select an image file from my device using the existing toolbar button, so that the file is submitted to the upload pipeline without any new UI.

#### Acceptance Criteria

1. WHEN the user activates the image toolbar button, THE Editor SHALL present a file picker dialog that accepts only files with MIME types `image/jpeg`, `image/png`, `image/gif`, and `image/webp`.
2. WHEN the user selects a file that is larger than 10 MB, THE Editor SHALL reject the file before making a network request and display an error notification to the user.
3. WHEN the user selects a file whose MIME type is not one of the Accepted Formats, THE Editor SHALL reject the file before making a network request and display an error notification to the user.
4. WHEN the user selects a valid file, THE Editor SHALL invoke the Upload Callback with the selected `File` object.

### Requirement 2: Upload Callback Integration

**User Story:** As an admin editor, I want the image upload to be handled automatically after file selection, so that the Tiptap document receives a permanent URL instead of a temporary blob URL.

#### Acceptance Criteria

1. WHEN the Upload Callback is invoked with a valid `File` object, THE Editor SHALL send a `multipart/form-data` `POST` request to `/api/image-upload` with the file appended under the field name `file`.
2. WHEN the Upload Route responds with a 200 status, THE Editor SHALL resolve the Upload Callback promise with the `url` string from the JSON response body.
3. WHEN the Upload Route responds with an error status, THE Editor SHALL reject the Upload Callback promise and display an error notification to the user.
4. WHILE an upload is in progress, THE Editor SHALL display a loading indicator within the editor content area where the image will be inserted.

### Requirement 3: Server-Side File Validation

**User Story:** As a system operator, I want the Upload Route to independently validate all incoming files, so that invalid or oversized files are rejected even if client-side checks are bypassed.

#### Acceptance Criteria

1. WHEN a request arrives at the Upload Route without a `file` field in the form data, THEN THE Upload Route SHALL return a 400 response with a JSON body `{ "error": "No file provided" }`.
2. WHEN a request arrives at the Upload Route with a file whose MIME type is not one of `image/jpeg`, `image/png`, `image/gif`, or `image/webp`, THEN THE Upload Route SHALL return a 400 response with a JSON body `{ "error": "Unsupported file type" }`.
3. WHEN a request arrives at the Upload Route with a file whose size exceeds 10 MB, THEN THE Upload Route SHALL return a 400 response with a JSON body `{ "error": "File too large" }`.
4. WHEN a valid file passes all server-side validation checks, THE Upload Route SHALL proceed to upload the file to R2.

### Requirement 4: R2 Storage Upload

**User Story:** As a system operator, I want uploaded images to be stored durably in Cloudflare R2, so that the images are accessible via a stable public URL.

#### Acceptance Criteria

1. WHEN a validated file is ready to be stored, THE Upload Route SHALL generate a unique object key by combining a UUID and the original file extension (e.g., `images/<uuid>.<ext>`).
2. WHEN uploading to R2, THE Upload Route SHALL use the `PutObjectCommand` from `@aws-sdk/client-s3` configured with the `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` environment variables.
3. WHEN the R2 `PutObjectCommand` succeeds, THE Upload Route SHALL return a 200 response with a JSON body `{ "url": "<R2_PUBLIC_URL>/<object-key>" }`.
4. IF the R2 `PutObjectCommand` throws an error, THEN THE Upload Route SHALL return a 500 response with a JSON body `{ "error": "Upload failed" }` and SHALL log the error server-side.

### Requirement 5: Environment Configuration

**User Story:** As a developer, I want all R2 credentials and configuration values to come from environment variables, so that no secrets are hard-coded and different environments can use different buckets.

#### Acceptance Criteria

1. THE Upload Route SHALL read the following environment variables at request time: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `R2_PUBLIC_URL`.
2. IF any of the required environment variables (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`) are absent at startup, THEN THE Upload Route SHALL return a 500 response with a JSON body `{ "error": "Server misconfiguration" }` for any incoming request.
3. THE Upload Route SHALL construct the R2 S3-compatible endpoint URL as `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`.
4. THE system SHALL include all five required R2 environment variable keys in the `.env.example` file of `apps/admin` with placeholder values.
