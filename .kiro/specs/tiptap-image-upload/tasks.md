# Implementation Plan: Tiptap Image Upload

## Overview

Replace the temporary blob URL stub in `Editor.tsx` with a real upload pipeline: a validated `uploadImage` client helper posts files to a new Next.js API route that stores them in Cloudflare R2 and returns a permanent CDN URL. The change touches two files and creates one new file.

## Tasks

- [x] 1. Add `@aws-sdk/client-s3` dependency and update environment configuration
  - Run `pnpm add @aws-sdk/client-s3 --filter admin` to install the S3 client
  - Append the five R2 environment variable keys to `apps/admin/.env.example` with placeholder values
  - _Requirements: 4.2, 5.1, 5.4_

- [x] 2. Implement the `uploadImage` client helper in `Editor.tsx`
  - [x] 2.1 Replace the Image upload stub with the `uploadImage` async helper
    - Add `ACCEPTED_MIME_TYPES` set and `MAX_FILE_SIZE_BYTES` constant above `buildExtensions`
    - Implement `uploadImage(file: File): Promise<string>` with client-side MIME and size validation
    - Validate MIME type; call `toast.error(...)` and throw on invalid type
    - Validate file size; call `toast.error(...)` and throw if > 10 MB
    - Build `FormData` with the file under the `"file"` field and `POST` to `/api/image-upload`
    - Reject and show toast on any non-ok response; resolve with `url` from JSON on success
    - Wire `uploadImage` into `Image.configure({ upload: uploadImage })`
    - Import `toast` from `sonner` at the top of `Editor.tsx`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.2 Write property test for invalid MIME type rejection (Property 1)
    - **Property 1: Invalid MIME types are always rejected client-side**
    - **Validates: Requirements 1.3**
    - For any `file.type` not in the accepted set, `uploadImage` must throw before `fetch` is called
    - Use `vi.spyOn(global, 'fetch')` to assert fetch is never invoked

  - [ ]* 2.3 Write property test for oversized file rejection (Property 2)
    - **Property 2: Oversized files are always rejected client-side**
    - **Validates: Requirements 1.2**
    - For any `file.size > 10_485_760`, `uploadImage` must throw before `fetch` is called

  - [ ]* 2.4 Write property test for correct FormData field name (Property 3)
    - **Property 3: Upload callback sends the file under the correct field name**
    - **Validates: Requirements 2.1**
    - For any valid file, the captured `FormData` passed to `fetch` must have `"file"` as the key

  - [ ]* 2.5 Write property test for verbatim URL resolution (Property 4)
    - **Property 4: Success response URL is returned verbatim**
    - **Validates: Requirements 2.2**
    - For any URL string `u` in the mocked 200 response, `uploadImage` must resolve to exactly `u`

  - [ ]* 2.6 Write property test for non-200 rejection (Property 5)
    - **Property 5: Any non-200 HTTP status rejects the upload callback**
    - **Validates: Requirements 2.3**
    - For any HTTP status code that is not 200, `uploadImage` must reject and call `toast.error`

- [x] 3. Checkpoint — client helper
  - Ensure all client-side tests pass, ask the user if questions arise.

- [x] 4. Implement the `POST /api/image-upload` route handler
  - [x] 4.1 Create `apps/admin/src/app/api/image-upload/route.ts` with environment validation
    - Import `NextRequest`, `NextResponse`, `S3Client`, `PutObjectCommand`, `randomUUID`, and `path`
    - Define `ACCEPTED_MIME_TYPES`, `MAX_FILE_SIZE_BYTES`, and `REQUIRED_ENV_VARS` constants
    - At the start of `POST`, check all five required env vars and return `500 { "error": "Server misconfiguration" }` if any are absent
    - Construct the R2 endpoint as `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 4.2 Add form data parsing and server-side file validation to the route
    - Parse `request.formData()` and extract the `file` field
    - Return `400 { "error": "No file provided" }` if `file` is absent or not a `File` instance
    - Return `400 { "error": "Unsupported file type" }` if `file.type` is not in the accepted set
    - Return `400 { "error": "File too large" }` if `file.size > MAX_FILE_SIZE_BYTES`
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 4.3 Add R2 upload logic and success/error responses to the route
    - Generate object key: `images/${randomUUID()}${path.extname(file.name).toLowerCase() || '.bin'}`
    - Instantiate `S3Client` with region `"auto"`, the constructed endpoint, and credentials from env vars
    - Convert file to `Buffer` via `file.arrayBuffer()` and call `PutObjectCommand` with `Bucket`, `Key`, `Body`, and `ContentType`
    - Wrap the `client.send()` call in try/catch; on error log with `console.error` and return `500 { "error": "Upload failed" }`
    - On success return `200 { "url": "${R2_PUBLIC_URL}/${key}" }`
    - _Requirements: 3.4, 4.1, 4.2, 4.3, 4.4_

  - [ ]* 4.4 Write property test for server MIME type rejection (Property 6)
    - **Property 6: Server rejects any non-accepted MIME type with 400**
    - **Validates: Requirements 3.2**
    - Mock env vars and `@aws-sdk/client-s3`; for any MIME type not in the accepted set, assert HTTP 400 with `{ "error": "Unsupported file type" }`

  - [ ]* 4.5 Write property test for server oversized file rejection (Property 7)
    - **Property 7: Server rejects oversized files with 400**
    - **Validates: Requirements 3.3**
    - For any file size > 10,485,760 bytes, assert HTTP 400 with `{ "error": "File too large" }`

  - [ ]* 4.6 Write property test for valid files reaching R2 (Property 8)
    - **Property 8: Valid files always reach R2**
    - **Validates: Requirements 3.4, 4.2**
    - For any valid file with all env vars present, assert `PutObjectCommand` is called exactly once with the correct `Bucket`, `ContentType`, and a `Key` matching the expected pattern

  - [ ]* 4.7 Write property test for object key pattern (Property 9)
    - **Property 9: Object key always matches the expected pattern**
    - **Validates: Requirements 4.1**
    - For any original filename with a recognized extension, assert the generated key matches `^images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]+$`

  - [ ]* 4.8 Write property test for public URL construction (Property 10)
    - **Property 10: Public URL is correctly constructed from env var and key**
    - **Validates: Requirements 4.3**
    - For any `R2_PUBLIC_URL` value and generated key `k`, assert the response `url` equals `${R2_PUBLIC_URL}/${k}`

  - [ ]* 4.9 Write property test for missing env var → 500 (Property 11)
    - **Property 11: Any missing required environment variable triggers 500**
    - **Validates: Requirements 5.2**
    - For any non-empty subset of the five required env vars that is absent, assert HTTP 500 with `{ "error": "Server misconfiguration" }`

  - [ ]* 4.10 Write property test for R2 endpoint construction (Property 12)
    - **Property 12: R2 endpoint URL is constructed from R2_ACCOUNT_ID**
    - **Validates: Requirements 5.3**
    - For any `R2_ACCOUNT_ID` string `id`, assert the `S3Client` is instantiated with endpoint `https://${id}.r2.cloudflarestorage.com`

- [x] 5. Final checkpoint — Ensure all tests pass
  - Run `pnpm --filter admin exec vitest --run` and confirm all tests pass; ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The `reactjs-tiptap-editor` `Image` extension shows a loading placeholder while the `upload` promise is pending, satisfying Requirement 2.4 at no extra cost
- Integration tests against real R2 credentials are out of scope for automated tasks
- Property tests should use `fast-check` (or `@fast-check/vitest`) for arbitrary value generation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "4.2"] },
    { "id": 3, "tasks": ["4.3"] },
    { "id": 4, "tasks": ["4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10"] }
  ]
}
```
