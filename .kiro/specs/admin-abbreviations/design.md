# Design Document: Admin Abbreviations

## Overview

This feature adds a full abbreviation management system to the knitting encyclopedia admin. Abbreviations (e.g. `K2tog`, `yo`, `ssk`) appear in knitting patterns and need to be stored, translated, and linked to encyclopedia entries so readers can understand them in their preferred language.

The implementation touches three distinct layers:

1. **Database** — three new Prisma models: `Abbreviation`, `AbbreviationTranslation`, `EntryAbbreviation`
2. **NestJS API** — a new `AdminAbbreviationModule` with controllers for abbreviation CRUD, translation CRUD, and entry-abbreviation linking
3. **Next.js Admin UI** — a standalone Abbreviations page, an entry form panel, an edit dialog, a typed API client, and two pure utility functions with property-based tests

### Key Design Decisions

- **Case-insensitive uniqueness via DB expression index**: The `(code, source_language)` unique constraint is enforced with `lower(code)` in Postgres so that `K2tog` and `k2tog` collide. NestJS catches the unique violation and surfaces it as HTTP 409.
- **Translation endpoints are CREATE + PATCH, not upsert**: Unlike categories/tags that use a single `PUT` upsert, the translation API exposes separate `POST` (create) and `PATCH` (update) endpoints. The frontend `upsertTranslation` client function decides which to call based on whether a translation row already exists.
- **Ranking is a pure client-side utility**: `rankAbbreviations` runs in the browser on the list returned from the API. The API orders by Postgres similarity for the search endpoint; the pure function is used within the entry form combobox for instant re-ranking as the user types.
- **`EntryAbbreviation` is a proper join table with metadata** (`is_primary`, `sort_order`), not a simple many-to-many. This means link/unlink/patch endpoints are separate from abbreviation CRUD.
- **The entry form `abbreviations: string[]` field is replaced** by a proper `AbbreviationsPanel` component that stores linked abbreviation IDs. The `EntryFormValues.abbreviations` field type changes from `string[]` to the join record shape.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Next.js Admin UI                │
│                                                  │
│  /abbreviations/page.tsx  (standalone page)      │
│  /entries/[id]/page.tsx   (entry form)           │
│                                                  │
│  components/abbreviations/                       │
│    AbbreviationsPanel     (entry form sidebar)   │
│    AbbreviationEditDialog (two-column edit)      │
│    AbbreviationCreateDialog (new from page)      │
│                                                  │
│  lib/api/abbreviations.ts  (typed API client)    │
│  lib/abbreviations-utils.ts (pure utilities)     │
└───────────────────┬─────────────────────────────┘
                    │ HTTP / JSON
┌───────────────────▼─────────────────────────────┐
│           NestJS API (apps/api/src/)             │
│                                                  │
│  admin/abbreviation/                             │
│    admin-abbreviation.controller.ts              │
│    admin-abbreviation.service.ts                 │
│    admin-abbreviation.module.ts                  │
│    dto/                                          │
│      create-abbreviation.dto.ts                  │
│      update-abbreviation.dto.ts                  │
│      create-translation.dto.ts                   │
│      update-translation.dto.ts                   │
│      link-entry-abbreviation.dto.ts              │
│      update-entry-abbreviation.dto.ts            │
│      list-abbreviations-query.dto.ts             │
│                                                  │
│  [registered in app.module.ts as                 │
│   AdminAbbreviationModule]                       │
└───────────────────┬─────────────────────────────┘
                    │ Prisma Client
┌───────────────────▼─────────────────────────────┐
│               PostgreSQL                         │
│                                                  │
│  abbreviation          (new)                     │
│  abbreviation_translation (new)                  │
│  entry_abbreviation    (new)                     │
└─────────────────────────────────────────────────┘
```

---

## Components and Interfaces

### Backend — NestJS Module

**Controller**: `AdminAbbreviationController`
- `@ApiTags('admin/abbreviations')`
- `@Controller('api/v1/admin')`
- `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles('editor')`

Endpoints:

| Method   | Path                                                          | Description                                    |
|----------|---------------------------------------------------------------|------------------------------------------------|
| `GET`    | `/abbreviations`                                              | Paginated list with optional `q`, `source_language`, `display_language`, `page`, `limit` |
| `GET`    | `/abbreviations/:id`                                          | Single abbreviation with translations + entry links |
| `POST`   | `/abbreviations`                                              | Create abbreviation (HTTP 201)                 |
| `PATCH`  | `/abbreviations/:id`                                          | Update code and/or source_language             |
| `DELETE` | `/abbreviations/:id`                                          | Delete abbreviation (HTTP 204)                 |
| `POST`   | `/abbreviations/:id/translations`                             | Create translation for a locale (HTTP 201)     |
| `PATCH`  | `/abbreviations/:id/translations/:locale`                     | Update existing translation                    |
| `DELETE` | `/abbreviations/:id/translations/:locale`                     | Remove translation (HTTP 204)                  |
| `POST`   | `/entries/:entryId/abbreviations`                             | Link abbreviation to entry (HTTP 201)          |
| `PATCH`  | `/entries/:entryId/abbreviations/:abbreviationId`             | Update join record metadata                    |
| `DELETE` | `/entries/:entryId/abbreviations/:abbreviationId`             | Unlink abbreviation from entry (HTTP 204)      |

**Service**: `AdminAbbreviationService`

Key methods:
- `findAll(query: ListAbbreviationsQueryDto)` — paginated list with case-insensitive `q` filter, `source_language` filter, optional `display_language` resolved via fallback chain
- `findOne(id: string)` — single record with translations and entry_abbreviations
- `create(dto: CreateAbbreviationDto)` — trim code, check uniqueness, create
- `update(id: string, dto: UpdateAbbreviationDto)` — partial update with uniqueness check
- `delete(id: string)` — delete (cascades handled by Prisma)
- `createTranslation(id: string, dto: CreateTranslationDto)` — check parent exists, check locale not already present, create
- `updateTranslation(id: string, locale: string, dto: UpdateTranslationDto)` — check both parent and locale row exist, update
- `deleteTranslation(id: string, locale: string)` — remove translation row
- `linkEntry(entryId: string, dto: LinkEntryAbbreviationDto)` — check both IDs exist, check not already linked, create join
- `updateLink(entryId: string, abbreviationId: string, dto: UpdateEntryAbbreviationDto)` — update join row metadata
- `unlinkEntry(entryId: string, abbreviationId: string)` — remove join row

**DTOs**:

```typescript
// create-abbreviation.dto.ts
class CreateAbbreviationDto {
  @IsString() @MaxLength(255) @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() source_language: string;
}

// update-abbreviation.dto.ts
class UpdateAbbreviationDto {
  @IsOptional() @IsString() @MaxLength(255) @IsNotEmpty() code?: string;
  @IsOptional() @IsString() @IsNotEmpty() source_language?: string;
}

// create-translation.dto.ts
class CreateTranslationDto {
  @IsString() @IsNotEmpty() locale: string;
  @IsOptional() @IsString() @MaxLength(500) short_meaning?: string | null;
  @IsOptional() description?: unknown | null; // Tiptap JSON — validated as object
}

// update-translation.dto.ts
class UpdateTranslationDto {
  @IsOptional() @IsString() @MaxLength(500) short_meaning?: string | null;
  @IsOptional() description?: unknown | null;
}

// link-entry-abbreviation.dto.ts
class LinkEntryAbbreviationDto {
  @IsUUID() abbreviation_id: string;
  @IsOptional() @IsBoolean() is_primary?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(9999) sort_order?: number;
}

// update-entry-abbreviation.dto.ts
class UpdateEntryAbbreviationDto {
  @IsOptional() @IsBoolean() is_primary?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(9999) sort_order?: number;
}

// list-abbreviations-query.dto.ts
class ListAbbreviationsQueryDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) q?: string;
  @IsOptional() @IsString() source_language?: string;
  @IsOptional() @IsString() display_language?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
```

### Frontend — API Client

**File**: `apps/admin/src/lib/api/abbreviations.ts`

```typescript
export interface Abbreviation {
  id: string;
  code: string;
  source_language: string;
  translations: AbbreviationTranslation[];
  entry_abbreviations?: EntryAbbreviation[];
  created_at: string;
  updated_at: string;
}

export interface AbbreviationTranslation {
  id: string;
  abbreviation_id: string;
  locale: string;
  short_meaning: string | null;
  description: unknown | null; // Tiptap JSON
  created_at: string;
  updated_at: string;
}

export interface EntryAbbreviation {
  entry_id: string;
  abbreviation_id: string;
  is_primary: boolean;
  sort_order: number;
}

export interface CreateAbbreviationPayload { code: string; source_language: string; }
export interface UpdateAbbreviationPayload { code?: string; source_language?: string; }
export interface UpsertAbbreviationTranslationPayload {
  short_meaning?: string | null;
  description?: unknown | null;
}
export interface LinkEntryAbbreviationPayload {
  abbreviation_id: string;
  is_primary?: boolean;
  sort_order?: number;
}

export interface ListAbbreviationsParams extends PaginationParams {
  q?: string;
  source_language?: string;
  display_language?: string;
}

export const abbreviationsApi = {
  listAbbreviations: (params?: ListAbbreviationsParams): Promise<ApiResponse<Abbreviation[]>> =>
    apiGetWithMeta<Abbreviation[]>('/api/v1/admin/abbreviations', params),
  getAbbreviation: (id: string): Promise<Abbreviation> =>
    apiGet<Abbreviation>(`/api/v1/admin/abbreviations/${id}`),
  createAbbreviation: (payload: CreateAbbreviationPayload): Promise<Abbreviation> =>
    apiPost<Abbreviation>('/api/v1/admin/abbreviations', payload),
  updateAbbreviation: (id: string, payload: UpdateAbbreviationPayload): Promise<Abbreviation> =>
    apiPatch<Abbreviation>(`/api/v1/admin/abbreviations/${id}`, payload),
  deleteAbbreviation: (id: string): Promise<void> =>
    apiDelete<void>(`/api/v1/admin/abbreviations/${id}`),
  upsertTranslation: (
    id: string, locale: string, payload: UpsertAbbreviationTranslationPayload,
    exists: boolean,
  ): Promise<AbbreviationTranslation> =>
    exists
      ? apiPatch<AbbreviationTranslation>(
          `/api/v1/admin/abbreviations/${id}/translations/${locale}`, payload)
      : apiPost<AbbreviationTranslation>(
          `/api/v1/admin/abbreviations/${id}/translations`, { locale, ...payload }),
  deleteTranslation: (id: string, locale: string): Promise<void> =>
    apiDelete<void>(`/api/v1/admin/abbreviations/${id}/translations/${locale}`),
  linkAbbreviation: (entryId: string, payload: LinkEntryAbbreviationPayload): Promise<EntryAbbreviation> =>
    apiPost<EntryAbbreviation>(`/api/v1/admin/entries/${entryId}/abbreviations`, payload),
  updateLink: (
    entryId: string, abbreviationId: string, payload: Partial<LinkEntryAbbreviationPayload>
  ): Promise<EntryAbbreviation> =>
    apiPatch<EntryAbbreviation>(
      `/api/v1/admin/entries/${entryId}/abbreviations/${abbreviationId}`, payload),
  unlinkAbbreviation: (entryId: string, abbreviationId: string): Promise<void> =>
    apiDelete<void>(`/api/v1/admin/entries/${entryId}/abbreviations/${abbreviationId}`),
};
```

### Frontend — Pure Utility Functions

**File**: `apps/admin/src/lib/abbreviations-utils.ts`

```typescript
export function rankAbbreviations(query: string, abbreviations: Abbreviation[]): Abbreviation[] {
  if (!query || abbreviations.length === 0) return abbreviations;
  const q = query.toLowerCase();
  const tier = (code: string): 0 | 1 | 2 => {
    const c = code.toLowerCase();
    if (c === q) return 0;
    if (c.startsWith(q)) return 1;
    return 2;
  };
  return [...abbreviations].sort((a, b) => {
    const ta = tier(a.code), tb = tier(b.code);
    if (ta !== tb) return ta - tb;
    return a.code.toLowerCase().localeCompare(b.code.toLowerCase());
  });
}

export function resolveTranslation(
  locale: string,
  translations: AbbreviationTranslation[],
): AbbreviationTranslation | null {
  if (translations.length === 0) return null;
  const exact = translations.find((t) => t.locale === locale);
  if (exact) return exact;
  const en = translations.find((t) => t.locale === 'en');
  if (en) return en;
  return translations[0];
}
```

### Frontend — UI Components

**`AbbreviationsPanel`** (`apps/admin/src/components/abbreviations/abbreviations-panel.tsx`)
- Lives in the entry form sidebar
- Receives `entryId`, `linkedAbbreviations: (EntryAbbreviation & { abbreviation: Abbreviation })[]`, and mutation callbacks
- Renders a list of linked abbreviation cards with code, source language badge, primary indicator, and sort_order
- Contains "Add new" button (opens `AbbreviationCreateDialog` pre-wired to link on save) and "Add existing" `Combobox` (debounced 300 ms, calls `listAbbreviations` with `q` and `source_language`)
- Each card has an edit button (opens `AbbreviationEditDialog`) and a remove button (calls `ConfirmDialog` then `unlinkAbbreviation`)

**`AbbreviationEditDialog`** (`apps/admin/src/components/abbreviations/abbreviation-edit-dialog.tsx`)
- Two-column layout matching the tag/category form pattern
- Left column: locale tabs (one per `useLanguages().allLocales`), each tab has `short_meaning` (plain `Input`) and `description` (`RichTextEditor`)
- Right sidebar: `code` input, `source_language` dropdown (from `useLanguages()`)
- Green dot tab indicator: tab has non-empty `short_meaning` (after trim) OR description with at least one text node with non-whitespace content
- On save: calls `updateAbbreviation` if code/source_language changed, then calls `upsertTranslation` for each dirty locale tab
- Multi-entry warning banner shown when the abbreviation is linked to >1 entry
- 409 conflict shown inline without closing dialog; other errors close dialog and show error toast (per Req 7.7)
- Partial translation failure (Req 7.8): keeps dialog open, shows inline message per failed locale

**`AbbreviationsPage`** (`apps/admin/src/app/(dashboard)/abbreviations/page.tsx`)
- Replaces current stub
- `PageHeader` with "Abbreviations" title
- Stats bar showing total count
- Search input (300 ms debounce) + source language filter dropdown (from `useLanguages()`)
- Table with columns: code, source language badge, linked entries count, translations count, created date
- "New abbreviation" button opens `AbbreviationCreateDialog`
- Row click opens `AbbreviationEditDialog`
- Delete action in row dropdown calls `ConfirmDialog` then `deleteAbbreviation`
- Empty state when no results

---

## Data Models

### Prisma Schema Additions

```prisma
model Abbreviation {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  /// The abbreviation as it appears in patterns, e.g. "K2tog", "yo"
  code            String   @db.VarChar(255)
  /// BCP-47 locale of the knitting tradition this abbreviation originates from
  source_language String
  created_at      DateTime @default(now()) @db.Timestamptz
  updated_at      DateTime @updatedAt @db.Timestamptz

  translations         AbbreviationTranslation[]
  entry_abbreviations  EntryAbbreviation[]

  /// Case-insensitive uniqueness enforced via expression index (see migration)
  @@index([source_language])
  @@map("abbreviation")
}

model AbbreviationTranslation {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  abbreviation_id String   @db.Uuid
  /// BCP-47 locale code: en, pl, de, no, fr
  locale          String
  /// Plain-text short meaning, e.g. "knit 2 together" (max 500 chars)
  short_meaning   String?  @db.VarChar(500)
  /// Tiptap JSON describing the abbreviation in detail
  description     Json?
  created_at      DateTime @default(now()) @db.Timestamptz
  updated_at      DateTime @updatedAt @db.Timestamptz

  abbreviation Abbreviation @relation(fields: [abbreviation_id], references: [id], onDelete: Cascade)

  @@unique([abbreviation_id, locale])
  @@index([locale])
  @@map("abbreviation_translation")
}

model EntryAbbreviation {
  entry_id        String  @db.Uuid
  abbreviation_id String  @db.Uuid
  /// Whether this is the primary abbreviation for this entry
  is_primary      Boolean @default(false)
  /// Display order within the entry's abbreviation list (0–9999)
  sort_order      Int     @default(0)

  entry        Entry        @relation(fields: [entry_id], references: [id], onDelete: Cascade)
  abbreviation Abbreviation @relation(fields: [abbreviation_id], references: [id], onDelete: Cascade)

  @@id([entry_id, abbreviation_id])
  @@index([entry_id])
  @@map("entry_abbreviation")
}
```

**Migration note**: The case-insensitive uniqueness constraint for `(code, source_language)` requires a raw SQL migration:

```sql
CREATE UNIQUE INDEX abbreviation_code_source_language_unique
  ON abbreviation (lower(code), source_language);
```

This is not expressible in Prisma's schema language alone; it must be added as a raw SQL migration step alongside the `prisma migrate dev` output.

The `Entry` model gains a new relation:
```prisma
// In Entry model — add:
abbreviations EntryAbbreviation[]
```

### EntryFormValues Change

The `abbreviations: string[]` field in `EntryFormValues` is replaced:

```typescript
// Before:
abbreviations: string[];

// After:
abbreviations: LinkedAbbreviationState[];

interface LinkedAbbreviationState {
  abbreviation_id: string;
  code: string;             // denormalized for display
  source_language: string;  // denormalized for display
  is_primary: boolean;
  sort_order: number;
  // populated from the API when editing an existing entry
  abbreviation?: Abbreviation;
}
```

The `AbbreviationsPanel` component manages this state. On form submit, the panel's mutations have already been fired against the API directly (optimistic updates), so the form submit itself does not need to batch abbreviation changes — they are persisted incrementally.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The ranking and fallback logic in this feature is implemented as pure functions (`rankAbbreviations` and `resolveTranslation` in `abbreviations-utils.ts`). These are the only components where property-based testing adds clear value. The API layer is integration-tested with example-based tests; the UI components are tested with component-level snapshot and interaction tests.

### Property 1: rankAbbreviations preserves the rank ordering invariant

*For any* non-empty query string `q` and any list of abbreviations, the output of `rankAbbreviations(q, list)` satisfies the ordering invariant: all abbreviations whose code exactly matches `q` (case-insensitively) appear before all prefix matches, and all prefix matches appear before all substring matches. Within each tier, items are ordered alphabetically by code (case-insensitive). When the input list is empty or contains no items matching the query, the function returns an array without throwing. When the input list is empty, the output is also empty.

**Validates: Requirements 10.1, 10.2, 10.3**

### Property 2: resolveTranslation follows the fallback chain for all inputs

*For any* locale string and any array of `AbbreviationTranslation` objects, `resolveTranslation(locale, translations)` returns the element whose `locale` field equals the requested locale if one exists; otherwise returns the element with `locale === 'en'` if one exists; otherwise returns `translations[0]` if the array is non-empty; otherwise returns `null`. No input causes the function to throw.

**Validates: Requirements 10.4, 10.5, 10.6, 10.7**

---

## Error Handling

### Backend

| Condition | Exception | HTTP Status |
|-----------|-----------|-------------|
| Resource not found (abbreviation, translation, join row) | `NotFoundException` | 404 |
| Duplicate `(code, source_language)` (case-insensitive) | `ConflictException` | 409 |
| Duplicate `(abbreviation_id, locale)` translation | `ConflictException` | 409 |
| Duplicate `(entry_id, abbreviation_id)` link | `ConflictException` | 409 |
| Blank/empty `code` after trimming | `BadRequestException` | 400 |
| Invalid `locale` format (spaces, invalid chars) | `BadRequestException` | 400 |
| `description` not valid JSON object | `BadRequestException` | 400 |
| `sort_order` out of range 0–9999 | `BadRequestException` | 400 |
| `q` parameter empty or >100 chars | `BadRequestException` | 400 |
| `limit` exceeds 100 | `BadRequestException` | 400 |
| Missing required field (`code`, `source_language`, `locale`) | class-validator / `BadRequestException` | 400 |
| Unauthenticated | JWT guard | 401 |
| Insufficient role | RolesGuard | 403 |

The global `PrismaExceptionFilter` handles Prisma unique constraint violations (`P2002`) and converts them to `ConflictException`. The `ResponseTransformInterceptor` wraps all responses in the `{ data, meta }` envelope.

### Frontend

| Condition | Behavior |
|-----------|----------|
| 409 on create/update abbreviation | Inline error message (does not close dialog) |
| 409 on link | Error toast via `sonner` |
| 404 on any mutation | Error toast |
| Network/server error (5xx) on dialog save | Close dialog, error toast (per Req 7.7) |
| Partial translation failure on dialog save | Keep dialog open, per-locale inline error (per Req 7.8) |
| Create succeeds but link fails | Success toast for creation, inline error for link failure (per Req 6.4) |
| 401 | Global `client.ts` redirect to `/login` |

---

## Testing Strategy

### Unit Tests — Pure Functions

Located at `apps/admin/src/lib/api/__tests__/abbreviations.property.test.ts` using `fast-check` (already a project dependency, pattern established in `content-block-types.property.test.ts`).

**Property Test 1: rankAbbreviations ordering invariant**

```typescript
// Feature: admin-abbreviations, Property 1: rankAbbreviations preserves the rank ordering invariant
fc.property(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.array(abbreviationArbitrary(), { maxLength: 30 }),
  (query, abbreviations) => {
    const result = rankAbbreviations(query, abbreviations);
    const q = query.toLowerCase();
    const tierOf = (code: string) => {
      const c = code.toLowerCase();
      if (c === q) return 0;
      if (c.startsWith(q)) return 1;
      return 2;
    };
    // Tier ordering invariant
    for (let i = 0; i < result.length - 1; i++) {
      expect(tierOf(result[i].code)).toBeLessThanOrEqual(tierOf(result[i + 1].code));
    }
    // Alphabetical within tier
    for (let i = 0; i < result.length - 1; i++) {
      if (tierOf(result[i].code) === tierOf(result[i + 1].code)) {
        expect(result[i].code.toLowerCase() <= result[i + 1].code.toLowerCase()).toBe(true);
      }
    }
    // Preserves all elements
    expect(result.length).toBe(abbreviations.length);
  },
  { numRuns: 100 },
)
```

**Property Test 2: resolveTranslation fallback chain**

```typescript
// Feature: admin-abbreviations, Property 2: resolveTranslation follows the fallback chain for all inputs
fc.property(
  fc.string({ minLength: 1, maxLength: 10 }),
  fc.array(translationArbitrary(), { maxLength: 10 }),
  (locale, translations) => {
    // Ensure no duplicate locales (one translation per locale invariant)
    const unique = Array.from(new Map(translations.map((t) => [t.locale, t])).values());
    const result = resolveTranslation(locale, unique);
    const exact = unique.find((t) => t.locale === locale);
    if (exact) {
      expect(result).toBe(exact);
    } else {
      const en = unique.find((t) => t.locale === 'en');
      if (en) {
        expect(result).toBe(en);
      } else if (unique.length > 0) {
        expect(result).toBe(unique[0]);
      } else {
        expect(result).toBeNull();
      }
    }
  },
  { numRuns: 100 },
)
```

Each test is configured with `numRuns: 100` minimum.

### Example-Based Unit Tests — Backend Service

Located at `apps/api/src/admin/abbreviation/__tests__/admin-abbreviation.service.spec.ts`.

Key scenarios:
- `create`: success, duplicate code/source_language (409), blank code (400)
- `findAll`: pagination defaults, `q` filter, `source_language` filter, `display_language` resolved via fallback
- `findOne`: success, not found (404)
- `update`: success, not found (404), duplicate (409)
- `delete`: success (cascades verified via Prisma mocks), not found (404)
- `createTranslation`: success, parent not found (404), duplicate locale (409), invalid JSON description (400)
- `updateTranslation`: success, parent not found (404), locale not found (404)
- `deleteTranslation`: success, not found (404)
- `linkEntry`: success, entry not found (404), abbreviation not found (404), already linked (409)
- `unlinkEntry`: success, not found (404)

### Integration / E2E Tests

Located at `apps/api/test/admin-abbreviation.e2e-spec.ts` (mirroring existing e2e test patterns).

Key flows:
- Full CRUD lifecycle: create → read → update → delete, verifying response envelopes at each step
- Translation lifecycle: create translation → update → delete → confirm parent unchanged
- Entry link lifecycle: link → verify in GET /entries/:id → unlink → verify removed
- Conflict scenarios: duplicate code/source_language returns 409 with error message
- Auth: unauthenticated request returns 401; editor role required

### Component Tests — Frontend

Located at `apps/admin/src/components/abbreviations/__tests__/`.

Key scenarios using React Testing Library:
- `AbbreviationsPanel`: renders linked abbreviations, "Add existing" combobox queries API with debounce, remove triggers `ConfirmDialog`
- `AbbreviationEditDialog`: locale tabs render, green dot appears when short_meaning is non-empty, 409 error shows inline without closing, partial failure keeps dialog open
- `AbbreviationsPage`: search debounce calls API, delete confirmation flow, empty state message

### Property Test Configuration

- Library: `fast-check` (already a dependency, version pinned in `package.json`)
- Minimum iterations: `numRuns: 100` per property test
- Tag comment format: `// Feature: admin-abbreviations, Property {N}: {property_text}`
- Each property corresponds to exactly one `fc.property(...)` call
