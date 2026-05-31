# Knitting Encyclopedia — Database Model

*Document version: 2.4 — May 2026*
*Supersedes: 03-data-model.md v2.3 (May 2026)*

---

## What changed in v2.4

- `Category.name` removed — display name and description now live in `CategoryTranslation` rows, one per locale; English is not a special case
- `Category.slug` removed from `Category` — locale-specific slugs live in `CategoryTranslation.slug`; the canonical internal identifier is `Category.id` (UUID)
- `CategoryTranslation` table added — holds `name`, `slug`, `description` (TipTap JSON), and `status` per locale; mirrors the `Entry` / `Translation` pattern
- `Category.status` added — `draft` · `published`; categories are not visible until published
- `Category.entry_count` added — denormalised counter; updated by trigger on `EntryCategory` insert/delete; avoids expensive COUNT joins on category index pages
- `Category.cover_image_url` added — optional CDN URL for richer category landing pages
- `Category.metadata` added — open-ended JSONB for future language-independent properties; GIN-indexed
- `Tag.name` removed — display name now lives in `TagTranslation` rows, one per locale
- `Tag.slug` added — canonical internal identifier for API routing and seeding (English, kebab-case)
- `TagTranslation` table added — holds `name` and `status` per locale; same pattern as `CategoryTranslation`
- Overview diagram updated to reflect new translation tables

## What changed in v2.3

- `Entry.slug` removed — `id` (UUID) is the internal identifier everywhere; public URLs always resolve via `Translation.slug`; no canonical English slug needed
- `Entry.term` removed — the English display name lives in the `en` `Translation` row like every other language; English is not a special case
- `Entry.origin_language` added as a dedicated typed column — promoted from `Entry.metadata`; too important and too frequently queried to remain a soft JSONB key; drives the traditions map, country landing pages, editorial attribution, and translation priority
- `Entry.search_vector` removed — English full-text search now handled entirely by the `en` `Translation` row's `search_vector`, consistent with all other locales; no special English search path
- `origin_language` removed from `Entry.metadata` well-known keys

## What changed in v2.2

- `Translation.definition` removed — all block content lives in `Translation.blocks` keyed by block ID
- `Translation.abbreviation` removed — moved into `Translation.metadata`
- `Translation.metadata` added — locale-specific structured properties: `abbreviation`, `definition_short`, and any future per-locale fields
- `Entry.definition_short` removed as a column — English short description lives in `Entry.metadata.definition_short`; each locale's version lives in `Translation.metadata.definition_short`
- `Technique` and `TechniqueTranslation` tables removed — technique content is a content block; translated name and steps live in `Translation.blocks`
- `Abbreviation` table removed — covered by `Translation.metadata.abbreviation` per locale; US/UK variants use `en-US` / `en-GB` locale codes

---

## Overview

The encyclopedia is built around a central `Entry` entity — a single knitting term such as *yarn over*, *kfb*, or *short row*. Every other table enriches, connects, or contextualises it. The model supports multilingual content, hierarchical categories, rich media, block-based page layout, pattern cross-referencing, and editorial workflows with role-based structure control.

```
Entry        ←→  Category            (many-to-many via EntryCategory)
Entry        ←→  Tag                 (many-to-many via EntryTag)
Entry         →  Translation         (one-to-many, unique per locale)
Entry         →  MediaAsset          (one-to-many)
Entry         →  PatternUsage        (one-to-many)
Entry        ←→  Entry               (self-join via RelatedEntry)
Entry         →  BlockTemplate       (one per entry type — seeding only)
Category      →  Category            (self-join via parent_id)
Category      →  CategoryTranslation (one-to-many, unique per locale)
Tag           →  TagTranslation      (one-to-many, unique per locale)
```

---

## Entities

---

### Entry

The core encyclopedia entry. Every other table points back to this one.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | UUID v7 (time-ordered) for index locality. The sole internal identifier — used in admin, API routes, seeds, and inter-entry relations. Never reuse. |
| `origin_language` | string | NOT NULL | BCP-47 code of the tradition the entry originates from: `en`, `pl`, `no`, `de`, `fr`. Drives the traditions map, country landing pages, editorial attribution, and translation priority queuing. Constrained to supported locale codes. |
| `status` | enum | | `draft` · `review` · `published` · `deprecated`. Deprecated entries are retained — they still appear in historical patterns. Never hard-delete. |
| `metadata` | jsonb | default `{}` | Language-independent structured properties with no fixed schema. Well-known keys: `skill_level`, `definition_short` (English fallback ≤160 chars). Open-ended keys: `reversible`, `stretchiness`, `recommended_needle_size`, `yarn_weight`, etc. GIN-indexed; queryable via `metadata->>'key'`. |
| `content_blocks` | jsonb | default `[]` | Ordered `ContentBlock[]` array — the layout manifest for the entry detail page. Holds block types, IDs, order, visibility, and non-translatable block config. Never holds translated content. Admins control this field; editors control content in `Translation.blocks`. |
| `created_at` | timestamptz | UTC | |
| `updated_at` | timestamptz | UTC | |
| `published_at` | timestamptz | nullable, UTC | Null until editorially approved. |

**Well-known `metadata` keys on Entry**

| Key | Type | Notes |
|---|---|---|
| `skill_level` | string | `beginner` · `intermediate` · `advanced` · `expert`. Entry-level default; overridable per `PatternUsage` row. |
| `definition_short` | string | ≤160 chars. English canonical summary — used as fallback for search snippets, tooltips, and social previews when no `Translation.metadata.definition_short` exists for the active locale. |

**Design notes**

- `id` is the only identifier on `Entry`. There is no slug, no canonical term. Display names and URL slugs live entirely in `Translation` rows. Admins and seed files reference entries by UUID or by looking up a known `Translation` term.
- `origin_language` is a column, not a metadata key, because it is structural — it drives joins, filters, and editorial workflows. A soft JSONB key cannot be constrained or indexed with the same guarantees.
- `content_blocks` is a pure layout manifest. All translatable content lives in `Translation.blocks`, keyed by the same block IDs.
- `metadata` holds properties that are language-independent and do not need referential integrity. Do not store prose, translations, or HTML here.
- English full-text search is handled by the `en` (or `en-US`, `en-GB`) `Translation` row's `search_vector` — identical to every other locale. There is no special English search path on `Entry`.

---

### ContentBlock

Stored as a `jsonb` array on `Entry.content_blocks`. Each element is a typed block describing one section of the entry detail page. The frontend iterates this array and renders each block with its corresponding component. Translated content for each block is looked up from `Translation.blocks[block.id]`. Adding a new block type requires only a new component and a new `case` in the renderer — no schema migration.

**Base shape (all blocks)**

```ts
{
  id:      string   // stable UUID — used as the key in Translation.blocks
  type:    string   // discriminator — see block types below
  order:   number   // sort position; lower = higher on page
  visible: boolean  // false = hidden but not deleted (soft-remove by admin)
}
```

**Block types at launch**

```ts
{ type: "definition" }
// Prose definition. Translated content in Translation.blocks[id] as TipTap JSON.

{ type: "technique" }
// How-to instructions.
// Translation.blocks[id]: { name: string, difficulty: string, steps: { order: number, text: string }[] }

{ type: "media"; assetId: string }
// One MediaAsset. assetId references MediaAsset.id — locale-independent.
// Translation.blocks[id]: { alt_text: string, caption?: string }

{ type: "callout"; variant: "tip" | "warning" }
// Editorial callout box. variant is non-translatable config stored on the block.
// Translation.blocks[id]: { text: string }

{ type: "related" }
// RelatedEntry section — synonym, prerequisite, variant cards.
// No Translation.blocks entry needed; labels come from linked Translation rows.

{ type: "pattern_usage" }
// PatternUsage list with context notes and frequency bars.
// No Translation.blocks entry needed.
```

**Block types available post-launch (no migration needed)**

```ts
{ type: "ad_slot";      slotId: string }
{ type: "interactive";  componentId: string; props: Record<string, unknown> }
{ type: "quiz";         questionId: string }
{ type: "video";        url: string }
{ type: "divider" }
```

**Example `content_blocks` value**

```json
[
  { "id": "a1b2c3d4", "type": "definition",    "order": 1, "visible": true },
  { "id": "b2c3d4e5", "type": "technique",     "order": 2, "visible": true },
  { "id": "c3d4e5f6", "type": "technique",     "order": 3, "visible": true },
  { "id": "d4e5f6g7", "type": "media",         "order": 4, "visible": true, "assetId": "uuid-1" },
  { "id": "e5f6g7h8", "type": "callout",       "order": 5, "visible": true, "variant": "tip" },
  { "id": "f6g7h8i9", "type": "related",       "order": 6, "visible": true },
  { "id": "g7h8i9j0", "type": "pattern_usage", "order": 7, "visible": true }
]
```

**Corresponding `Translation.blocks` value (Polish)**

```json
{
  "a1b2c3d4": {
    "type": "doc",
    "content": [
      { "type": "paragraph", "content": [
        { "type": "text", "text": "Dodatkowa pętelka owijana wokół drutów, tworząca oczko ozdobne. Stosowana razem z " },
        { "type": "entry_link", "attrs": { "entryId": "uuid-decrease", "term": "zbiéranie" } },
        { "type": "text", "text": " w robotach ażurowych." }
      ]}
    ]
  },
  "b2c3d4e5": {
    "name": "Nabieranie przez długą pętelkę",
    "difficulty": "beginner",
    "steps": [
      { "order": 1, "text": "Zrób pętelkę i załóż na drut." },
      { "order": 2, "text": "Trzymaj nitkę na kciuku i wskazującym." }
    ]
  },
  "c3d4e5f6": {
    "name": "Podwójny nawijak",
    "difficulty": "intermediate",
    "steps": [
      { "order": 1, "text": "Owiń nitkę dwukrotnie wokół drutu." }
    ]
  },
  "d4e5f6g7": {
    "alt_text": "Diagram pokazujący owinięcie nitki wokół drutów.",
    "caption": "Nakrycie oczka — widok z góry."
  },
  "e5f6g7h8": {
    "text": "Oznaczenia US i UK różnią się — 'yo' w USA odpowiada 'yfwd' w UK."
  }
}
```

**Visibility rule**

When an admin hides a block, set `visible: false` on the block in `content_blocks`. Do not remove the block's key from `Translation.blocks` — content is preserved and can be restored by an admin setting `visible: true`. Editors can see hidden blocks in the admin UI but cannot change visibility.

---

### BlockTemplate

Default `content_blocks` array for each entry type. When an admin creates a new entry, `content_blocks` is seeded from the template for its type. Admins can deviate per-entry after creation. Changing a template does not retroactively update existing entries.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `entry_type` | string | unique | e.g. `stitch`, `technique`, `tool`, `tradition`, `yarn_weight` |
| `blocks` | jsonb | default `[]` | Default `ContentBlock[]` — all `visible: true`, block IDs pre-generated, no content yet |
| `updated_at` | timestamptz | UTC | |

Managed in the admin UI at `/admin/settings/templates`.

---

### Translation

All locale-specific content for an entry — display name, public URL slug, structured metadata, and the full translated content of every block. One row per locale per entry.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `entry_id` | uuid | FK → Entry | |
| `locale` | string | BCP-47 | e.g. `pl`, `de`, `no`, `fr`, `en`, `en-US`, `en-GB` |
| `slug` | string | | Locale-specific public URL slug, e.g. `scieg-brioche` for Polish, `yarn-over` for English. Used by middleware for URL resolution. |
| `term` | string | | Display name in this locale. The English `en` row's `term` is the canonical display name for English — there is no separate canonical term on `Entry`. |
| `metadata` | jsonb | default `{}` | Locale-specific structured properties. Well-known keys: `abbreviation`, `definition_short`. Open-ended for future locale-specific properties. |
| `blocks` | jsonb | default `{}` | Translated content keyed by `ContentBlock.id`. Shape per key depends on block type — see block content shapes below. |
| `translator_note` | text | nullable | Editorial context visible to translators and reviewers. |
| `status` | enum | | `draft` · `reviewed` · `published` |
| `search_vector` | tsvector | | Updated by trigger on INSERT/UPDATE. Indexes `term`, `metadata->>'definition_short'`, and all text nodes extracted from `blocks`. Uses locale-appropriate PostgreSQL dictionary. |

Unique constraints: `(entry_id, locale)` and `(locale, slug)`.

**Well-known `metadata` keys on Translation**

| Key | Type | Notes |
|---|---|---|
| `abbreviation` | string | Locale-specific abbreviation, e.g. `ścr`, `M`, `Umschlag`, `yo`, `yfwd`. Use `en-US` / `en-GB` locale codes to capture US vs UK divergence cleanly. |
| `definition_short` | string | ≤160 chars. Locale-native summary for tooltips, search snippets, and social previews. Falls back to `Entry.metadata.definition_short` (English) if absent. |

**URL resolution**

Middleware passes `{ locale, slug }` to the API. The API resolves via `WHERE locale = $1 AND slug = $2` on `Translation`, then joins to `Entry`. `Entry.id` is never exposed in public URLs.

**`search_vector` maintenance**

`search_vector` is maintained by a trigger rather than a generated column because the content is spread across nested JSONB in `blocks`. The trigger fires on INSERT or UPDATE, extracts all `text` nodes from `blocks` values using `jsonb_path_query`, combines with `term` and `metadata->>'definition_short'`, and calls `to_tsvector` with the locale-appropriate dictionary.

---

### Translation — block content shapes

`Translation.blocks` is a JSON object keyed by `ContentBlock.id`. The value shape depends on `block.type`.

**`definition` block** — TipTap JSON, minimal node schema

Permitted nodes: `paragraph`, `hard_break`, `bold` (mark), `italic` (mark), `entry_link` (custom inline: `{ entryId, term }` — links to another entry by UUID, renders as InlineEntryCard).

```json
{ "a1b2c3d4": { "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }] } }
```

**`technique` block**

```json
{ "b2c3d4e5": { "name": "Long-tail cast-on", "difficulty": "beginner", "steps": [{ "order": 1, "text": "Make a slip knot." }] } }
```

**`media` block** — translated alt text and caption; URL lives on `MediaAsset` and is locale-independent

```json
{ "d4e5f6g7": { "alt_text": "Diagram of yarn wrapping around needle.", "caption": "Yarn over — top view." } }
```

**`callout` block**

```json
{ "e5f6g7h8": { "text": "US 'yo' corresponds to UK 'yfwd'." } }
```

**`related` and `pattern_usage` blocks** — no entry in `blocks` needed; content comes from linked `Translation` rows and `PatternUsage` rows.

---

### Category

Hierarchical taxonomy. Supports unlimited depth via `parent_id` self-join; 2–3 levels recommended. Display names, descriptions, and public URL slugs live in `CategoryTranslation` — one row per locale.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | UUID v7. The sole internal identifier — used in admin, API routes, seeds, and `EntryCategory` joins. Never reuse. |
| `parent_id` | uuid | FK → Category, nullable | Null for top-level categories. |
| `icon` | string | nullable | Icon key or SVG path — locale-independent. |
| `sort_order` | integer | default 0 | Display ordering within parent. |
| `status` | enum | default `draft` | `draft` · `published`. A category is not visible on the public site until published. |
| `entry_count` | integer | default 0 | Denormalised count of published entries in this category (direct, not recursive). Updated by trigger on `EntryCategory` insert/delete. Used by the category index page to avoid COUNT joins. |
| `cover_image_url` | string | nullable | CDN URL (Cloudflare R2). Optional cover image for richer category landing pages. |
| `metadata` | jsonb | default `{}` | Open-ended language-independent properties. GIN-indexed. No well-known keys at launch. |
| `created_at` | timestamptz | UTC | |
| `updated_at` | timestamptz | UTC | |

Many-to-many with `Entry` via `EntryCategory(entry_id, category_id)`.

**Design notes**

- `Category.id` is the only identifier on `Category`. There is no canonical slug or name on the table itself — these live in `CategoryTranslation` rows, exactly as `Entry` delegates display names and slugs to `Translation`.
- The `en` `CategoryTranslation` row's `name` is the canonical English display name. The `en` row's `slug` is the canonical English URL segment (e.g. `stitches`, `lace-knitting`).
- `entry_count` is a denormalised integer maintained by a trigger. It counts direct `EntryCategory` associations where the linked `Entry.status = 'published'`. Recursive counts (including subcategory entries) are computed at query time when needed.

---

### CategoryTranslation

All locale-specific content for a category — display name, public URL slug, and rich-text description. One row per locale per category.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `category_id` | uuid | FK → Category | |
| `locale` | string | BCP-47 | e.g. `pl`, `de`, `no`, `fr`, `en` |
| `slug` | string | | Locale-specific public URL slug, e.g. `sciegi` for Polish, `stitches` for English. Used by middleware for URL resolution. |
| `name` | string | | Display name in this locale, e.g. `Stitches`, `Ściegi`. |
| `description` | jsonb | default `null` | TipTap JSON — editorial introduction to the category (e.g. "About lace knitting"). Same node schema as the `definition` content block. Nullable — not all categories have a description at launch. |
| `status` | enum | default `draft` | `draft` · `reviewed` · `published`. Mirrors `Translation.status`. |
| `translator_note` | text | nullable | Editorial context visible to translators and reviewers. |
| `created_at` | timestamptz | UTC | |
| `updated_at` | timestamptz | UTC | |

Unique constraints: `(category_id, locale)` and `(locale, slug)`.

**URL resolution**

Middleware passes `{ locale, slug }` to the API. The API resolves via `WHERE locale = $1 AND slug = $2` on `CategoryTranslation`, then joins to `Category`. `Category.id` is never exposed in public URLs.

**`description` node schema**

Permitted TipTap nodes: `paragraph`, `heading` (h2, h3), `bold` (mark), `italic` (mark), `hard_break`, `entry_link` (custom inline: `{ entryId, term }` — links to an entry by UUID). Same permitted nodes as the `definition` content block on entries.

---

**Top-level categories**

| Category (English) | Representative subcategories |
|---|---|
| Stitches | Basic stitches, Increases, Decreases, Slip & twist |
| Techniques | Cast-on methods, Bind-off methods, Colorwork, Lace, Cables |
| Tools & materials | Needle types, Notions, Needle sizing, Gauge & tension |
| Yarn & fiber | Yarn weights, Fiber types, Yarn construction, Care & dye |
| Construction | Shaping, In the round, Short rows, Seaming & joining |
| Finishing | Blocking, Ends & weaving, Embellishments |
| Traditions & styles | Fair Isle, Aran, Entrelac, Regional styles |

---

### Tag

Lightweight labels for cross-cutting concerns that don't fit the category hierarchy. Display names live in `TagTranslation` — one row per locale.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `slug` | string | unique | Canonical English kebab-case identifier, e.g. `wool`, `dpn`, `sleeve`, `fair-isle`. Used in admin, API routes, and seeds. Never changes. |
| `type` | enum | | `fiber_type` · `needle_type` · `garment_part` · `style_tradition` — language-independent classification. |
| `color_hex` | string | nullable | For UI badge rendering — locale-independent. |

Many-to-many with `Entry` via `EntryTag(entry_id, tag_id)`.

**Design notes**

- `Tag.slug` is the canonical internal identifier (replaces the old `name` unique constraint). It is always English kebab-case and never changes.
- Display names per locale live in `TagTranslation.name`. The `en` row's `name` is the canonical English display name.
- Tags are simpler than categories — no hierarchy, no description, no status lifecycle beyond the translation row's own status.

---

### TagTranslation

Locale-specific display name for a tag. One row per locale per tag.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `tag_id` | uuid | FK → Tag | |
| `locale` | string | BCP-47 | e.g. `pl`, `de`, `no`, `fr`, `en` |
| `name` | string | | Display name in this locale, e.g. `wełna` (Polish), `wool` (English). |
| `status` | enum | default `draft` | `draft` · `reviewed` · `published`. |
| `created_at` | timestamptz | UTC | |
| `updated_at` | timestamptz | UTC | |

Unique constraint: `(tag_id, locale)`.

---

### RelatedEntry

Self-join on `Entry` modelling relationships between terms.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `entry_id` | uuid | FK → Entry | Source entry |
| `related_id` | uuid | FK → Entry | Target entry |
| `relation_type` | enum | | See relation types below |
| `direction` | enum | | `symmetric` · `directed` |
| `note` | text | nullable | Editorial context explaining the relationship |

**Relation type enum**

| Value | Example |
|---|---|
| `synonym` | *yarn over* ↔ *yarn forward* |
| `antonym` | *increase* ↔ *decrease* |
| `prerequisite` | *twisted stitch* requires *knit stitch* |
| `variant_regional` | *yarn over* (US) ↔ *wool forward* (UK) |
| `variant_technique` | *yarn over* ↔ *double yarn over* |
| `broader` | *yarn over* is narrower than *increase* |
| `narrower` | *increase* is broader than *yarn over* |

`variant_regional` is the most important type — US and UK terminology diverges significantly, and readers searching with one convention must always find the other.

---

### MediaAsset

Images, diagrams, and video clips attached to an entry. Alt text and caption are locale-specific and live in `Translation.blocks`, not here.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `entry_id` | uuid | FK → Entry | |
| `type` | enum | | `image` · `diagram` · `video_clip` · `chart` |
| `url` | string | | CDN URL (Cloudflare R2) — locale-independent |
| `sort_order` | integer | | Used when a media block renders a gallery of multiple assets |

---

### PatternUsage

Records how and where an entry appears in real-world knitting patterns.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `entry_id` | uuid | FK → Entry | |
| `pattern_name` | string | | Display name of the pattern |
| `pattern_id` | uuid | nullable | FK to a `Pattern` master table once one exists (post-launch) |
| `context_note` | text | | How the entry is specifically used — the most editorially valuable field |
| `frequency` | integer | | How many times the entry appears; drives usage bar charts |
| `skill_level` | enum | nullable | Context-sensitive override for `Entry.metadata.skill_level` |

`context_note` distinguishes this from a simple count. Two patterns can use *yarn over* 50 times in fundamentally different ways — lace eyelet vs. raglan spine increase.

---

### Article

Long-form editorial content — technique deep-dives, regional histories, tradition overviews.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `slug` | string | unique | Canonical English slug, immutable |
| `title` | string | | Canonical English title |
| `content` | jsonb | | TipTap JSON — extended node schema (see below) |
| `cover_image_url` | string | nullable | CDN URL |
| `author` | string | | Display name |
| `country_code` | string | nullable | Country attribution |
| `reading_time_minutes` | integer | | Denormalised; computed on save |
| `status` | enum | | `draft` · `review` · `published` |
| `published_at` | timestamptz | nullable, UTC | |
| `created_at` | timestamptz | UTC | |
| `updated_at` | timestamptz | UTC | |

Many-to-many with `Tag` via `ArticleTag(article_id, tag_id)`.

**Article content — extended TipTap node types**

```
heading         — h2 and h3 only; h1 is the article title
paragraph
bold / italic / underline
blockquote      — pull quotes
image           — { assetId: string } — references MediaAsset.id, not a raw URL
entry_card      — { entryId: string, term: string } — inline entry card;
                  frontend fetches live translation at render time
horizontal_rule
ordered_list / bullet_list / list_item
```

---

### LearningPath

Curated ordered sequences of entries forming a structured learning path.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `slug` | string | unique | |
| `title` | string | | |
| `description` | string | | |
| `skill_level_min` | enum | | Starting skill level of the path |
| `skill_level_max` | enum | | Ending skill level of the path |
| `estimated_minutes` | integer | | Denormalised; computed from entry count |
| `published` | boolean | | |

Many-to-many with `Entry` via `LearningPathEntry(path_id, entry_id, sort_order)`.

---

### Contribution

Pending public submissions — new entries, translation contributions, and correction reports.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `type` | enum | | `entry` · `translation` · `correction` |
| `status` | string | default `pending` | `pending` · `approved` · `rejected` |
| `payload` | jsonb | | Submitted data, shaped per type |
| `entry_id` | uuid | FK → Entry, nullable | Set for translation and correction submissions |
| `submitter_email` | string | nullable | Optional; used for status notification |
| `reviewer_note` | string | nullable | Set on approve or reject |
| `submitted_at` | timestamptz | UTC | |
| `reviewed_at` | timestamptz | nullable, UTC | |

Approved entry submissions create a new `Entry` with `content_blocks` seeded from `BlockTemplate`. Approved translation submissions create or update a `Translation` row. Rejected submissions are archived with `reviewer_note`.

---

### User

Editorial team members. Not exposed to public readers.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `email` | string | unique | |
| `name` | string | | |
| `role` | enum | | `editor` · `reviewer` · `admin` |
| `password_hash` | string | | bcrypt |
| `created_at` | timestamptz | UTC | |

**Role capabilities**

| Capability | editor | reviewer | admin |
|---|---|---|---|
| Edit block content (`Translation.blocks`) | ✓ | ✓ | ✓ |
| Edit `Translation.metadata` and `term` | ✓ | ✓ | ✓ |
| Edit `Entry.metadata` | ✓ | ✓ | ✓ |
| Review and approve submissions | — | ✓ | ✓ |
| Reorder content blocks (`Entry.content_blocks`) | — | — | ✓ |
| Add / remove / hide blocks | — | — | ✓ |
| Manage block templates | — | — | ✓ |
| Publish / deprecate entries | — | ✓ | ✓ |
| Manage users | — | — | ✓ |

---

## Enum Reference

### `skill_level`
`beginner` · `intermediate` · `advanced` · `expert`
Used by: `Entry.metadata.skill_level`, `PatternUsage.skill_level`, technique block `difficulty`, `LearningPath.skill_level_min/max`

### `entry_status`
`draft` · `review` · `published` · `deprecated`

### `translation_status`
`draft` · `reviewed` · `published`
Used by: `Translation.status`, `CategoryTranslation.status`, `TagTranslation.status`

### `category_status`
`draft` · `published`
Used by: `Category.status`

### `media_type`
`image` · `diagram` · `video_clip` · `chart`

### `tag_type`
`fiber_type` · `needle_type` · `garment_part` · `style_tradition`

### `relation_type`
`synonym` · `antonym` · `prerequisite` · `variant_regional` · `variant_technique` · `broader` · `narrower`

### `contribution_type`
`entry` · `translation` · `correction`

### `user_role`
`editor` · `reviewer` · `admin`

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| No `slug` or `term` on `Entry` | English is just another locale. The `en` `Translation` row holds the English display name and slug like every other language. Eliminates the ambiguity of which row is authoritative. |
| `Entry.id` (UUID) as sole internal identifier | Used in admin, API, seeds, and inter-entry relations. Admins look up entries by UUID or by querying a known `Translation`. No human-readable slug needed for internal routing. |
| `Entry.origin_language` as a typed column | Promoted from `metadata` because it is structural — drives the traditions map, country landing pages, editorial attribution, and translation priority. A JSONB key cannot carry the same constraint guarantees. |
| `Translation.slug` is the public URL identifier | Each locale gets a native slug. Resolved by the `(locale, slug)` unique index. Middleware passes `{ locale, slug }` to the API; `Entry.id` is never in a public URL. |
| `Translation.term` as the display name per locale | The `en` row's `term` is the canonical English name. No special English field on `Entry`. |
| `Entry.content_blocks` as pure layout manifest | Separates structure from content. Admins control layout; editors control content. New block types require no schema migration. |
| `Translation.blocks` keyed by block ID | All translated block content in one row per locale. One join to render a full page in any locale. Adding a new translatable block type costs nothing. |
| `Translation.metadata` for locale-specific structured properties | `abbreviation`, `definition_short`, and future per-locale properties. Consistent with `Entry.metadata`. Avoids schema migrations. |
| `Entry.metadata` for language-independent structured properties | `skill_level`, `definition_short` (English fallback), and open-ended corpus-specific keys. GIN-indexed. |
| `definition_short` in both `Entry.metadata` and `Translation.metadata` | `Entry.metadata` holds the English fallback. `Translation.metadata` holds the locale-native version. API returns locale version when present, falls back to English. |
| No `Technique` / `TechniqueTranslation` tables | Technique content is a block like any other. Translated name and steps live in `Translation.blocks`. Eliminates a parallel translation surface. |
| No `Abbreviation` table | Covered by `Translation.metadata.abbreviation` per locale. US/UK variants use `en-US` / `en-GB` locale codes. |
| `search_vector` on `Translation` via trigger | All search — including English — goes through `Translation`. No special English search path on `Entry`. Trigger extracts text from nested JSONB in `blocks`, combining with `term` and `metadata->>'definition_short'`. |
| `visible: false` instead of block deletion | Preserves translated content in `Translation.blocks` when a block is hidden. Admin can restore without data loss. |
| `BlockTemplate` per entry type | Default layouts per entry type. Applies to newly created entries only. |
| `PatternUsage.skill_level` as typed enum | Context-sensitive override of `Entry.metadata.skill_level` with an explicit constraint. A *cast-on* is beginner in a dishcloth, intermediate in a provisional join. |
| `status = 'deprecated'` instead of hard delete | Deprecated entries remain accessible and are still referenced by historical patterns. |
| No `name` or `slug` on `Category` | Mirrors the `Entry` pattern. The `en` `CategoryTranslation` row holds the English display name and slug. English is not a special case. |
| `Category.id` (UUID) as sole internal identifier | Used in admin, API, seeds, and `EntryCategory` joins. No human-readable slug needed for internal routing. |
| `CategoryTranslation.slug` as the public URL identifier | Each locale gets a native category slug (e.g. `sciegi` in Polish, `stitches` in English). Resolved by the `(locale, slug)` unique index. Consistent with `Translation.slug` on entries. |
| `CategoryTranslation.description` as TipTap JSON | Rich-text editorial introduction per locale. Same node schema as the `definition` content block — reuses existing rendering infrastructure. Nullable at launch. |
| `Category.entry_count` as denormalised integer | Avoids expensive COUNT joins on the category index page. Maintained by trigger on `EntryCategory` insert/delete. Counts only direct associations where `Entry.status = 'published'`. |
| `Tag.slug` as canonical internal identifier | Replaces the old `name` unique constraint. Always English kebab-case, never changes. Display names per locale live in `TagTranslation.name`. |
| `TagTranslation` for tag display names | Tags appear in filter bars, badges, and article tag lists — all of which need locale-native labels. Consistent with `CategoryTranslation`. No description needed (tags are labels, not editorial content). |
| All timestamps UTC | Format for display in the UI layer only. |
| UUID v7 for all primary keys | Time-ordered for index locality. |

---

## PostgreSQL Quick-Start

```sql
CREATE TYPE skill_level_enum       AS ENUM ('beginner','intermediate','advanced','expert');
CREATE TYPE entry_status_enum      AS ENUM ('draft','review','published','deprecated');
CREATE TYPE trans_status_enum      AS ENUM ('draft','reviewed','published');
CREATE TYPE category_status_enum   AS ENUM ('draft','published');
CREATE TYPE relation_type_enum     AS ENUM ('synonym','antonym','prerequisite','variant_regional','variant_technique','broader','narrower');
CREATE TYPE media_type_enum        AS ENUM ('image','diagram','video_clip','chart');
CREATE TYPE tag_type_enum          AS ENUM ('fiber_type','needle_type','garment_part','style_tradition');
CREATE TYPE contribution_type_enum AS ENUM ('entry','translation','correction');
CREATE TYPE user_role_enum         AS ENUM ('editor','reviewer','admin');

-- Entry
CREATE TABLE entry (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_language  text NOT NULL,
  status           entry_status_enum NOT NULL DEFAULT 'draft',
  metadata         jsonb NOT NULL DEFAULT '{}',
  content_blocks   jsonb NOT NULL DEFAULT '[]',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  published_at     timestamptz
);
CREATE INDEX entry_metadata_idx      ON entry USING GIN(metadata);
CREATE INDEX entry_origin_lang_idx   ON entry(origin_language);

-- Translation
CREATE TABLE translation (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        uuid NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  locale          text NOT NULL,
  slug            text NOT NULL,
  term            text NOT NULL,
  metadata        jsonb NOT NULL DEFAULT '{}',
  blocks          jsonb NOT NULL DEFAULT '{}',
  translator_note text,
  status          trans_status_enum NOT NULL DEFAULT 'draft',
  search_vector   tsvector,
  UNIQUE (entry_id, locale),
  UNIQUE (locale, slug)
);
CREATE INDEX translation_search_idx   ON translation USING GIN(search_vector);
CREATE INDEX translation_blocks_idx   ON translation USING GIN(blocks);
CREATE INDEX translation_metadata_idx ON translation USING GIN(metadata);

-- Trigger to maintain Translation.search_vector
CREATE OR REPLACE FUNCTION translation_search_vector_update() RETURNS trigger AS $$
DECLARE
  dict       regconfig;
  block_text text;
BEGIN
  dict := CASE NEW.locale
    WHEN 'pl'    THEN 'polish'
    WHEN 'de'    THEN 'german'
    WHEN 'no'    THEN 'norwegian'
    WHEN 'fr'    THEN 'french'
    ELSE              'english'
  END;
  SELECT string_agg(val::text, ' ')
    INTO block_text
    FROM jsonb_path_query(NEW.blocks, 'strict $.**.text ? (@ != null)') val;
  NEW.search_vector := to_tsvector(dict,
    coalesce(NEW.term, '') || ' ' ||
    coalesce(NEW.metadata->>'definition_short', '') || ' ' ||
    coalesce(block_text, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER translation_search_vector_trigger
  BEFORE INSERT OR UPDATE ON translation
  FOR EACH ROW EXECUTE FUNCTION translation_search_vector_update();

-- Category
CREATE TABLE category (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id        uuid REFERENCES category(id),
  icon             text,
  sort_order       integer NOT NULL DEFAULT 0,
  status           category_status_enum NOT NULL DEFAULT 'draft',
  entry_count      integer NOT NULL DEFAULT 0,
  cover_image_url  text,
  metadata         jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX category_parent_idx   ON category(parent_id);
CREATE INDEX category_metadata_idx ON category USING GIN(metadata);

CREATE TABLE category_translation (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      uuid NOT NULL REFERENCES category(id) ON DELETE CASCADE,
  locale           text NOT NULL,
  slug             text NOT NULL,
  name             text NOT NULL,
  description      jsonb DEFAULT NULL,
  status           trans_status_enum NOT NULL DEFAULT 'draft',
  translator_note  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, locale),
  UNIQUE (locale, slug)
);
CREATE INDEX category_translation_locale_idx ON category_translation(locale);

-- Trigger to maintain Category.entry_count
CREATE OR REPLACE FUNCTION entry_category_count_update() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE category SET entry_count = entry_count + 1
    WHERE id = NEW.category_id
      AND EXISTS (SELECT 1 FROM entry WHERE id = NEW.entry_id AND status = 'published');
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE category SET entry_count = GREATEST(entry_count - 1, 0)
    WHERE id = OLD.category_id
      AND EXISTS (SELECT 1 FROM entry WHERE id = OLD.entry_id AND status = 'published');
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entry_category_count_trigger
  AFTER INSERT OR DELETE ON entry_category
  FOR EACH ROW EXECUTE FUNCTION entry_category_count_update();

CREATE TABLE entry_category (
  entry_id    uuid REFERENCES entry(id) ON DELETE CASCADE,
  category_id uuid REFERENCES category(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, category_id)
);

-- Tag
CREATE TABLE tag (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug      text UNIQUE NOT NULL,
  type      tag_type_enum,
  color_hex text
);

CREATE TABLE tag_translation (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id      uuid NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  locale      text NOT NULL,
  name        text NOT NULL,
  status      trans_status_enum NOT NULL DEFAULT 'draft',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag_id, locale)
);
CREATE INDEX tag_translation_locale_idx ON tag_translation(locale);

CREATE TABLE entry_tag (
  entry_id uuid REFERENCES entry(id) ON DELETE CASCADE,
  tag_id   uuid REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

-- RelatedEntry
CREATE TABLE related_entry (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      uuid NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  related_id    uuid NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  relation_type relation_type_enum NOT NULL,
  direction     text NOT NULL DEFAULT 'symmetric',
  note          text,
  CHECK (entry_id <> related_id)
);

-- MediaAsset
CREATE TABLE media_asset (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id   uuid NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  type       media_type_enum NOT NULL,
  url        text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

-- PatternUsage
CREATE TABLE pattern_usage (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id     uuid NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  pattern_name text NOT NULL,
  pattern_id   uuid,
  context_note text,
  frequency    integer NOT NULL DEFAULT 1,
  skill_level  skill_level_enum
);

-- BlockTemplate
CREATE TABLE block_template (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type text UNIQUE NOT NULL,
  blocks     jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Article
CREATE TABLE article (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text UNIQUE NOT NULL,
  title                text NOT NULL,
  content              jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}',
  cover_image_url      text,
  author               text NOT NULL,
  country_code         text,
  reading_time_minutes integer,
  status               entry_status_enum NOT NULL DEFAULT 'draft',
  published_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE article_tag (
  article_id uuid REFERENCES article(id) ON DELETE CASCADE,
  tag_id     uuid REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

-- LearningPath
CREATE TABLE learning_path (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text UNIQUE NOT NULL,
  title             text NOT NULL,
  description       text,
  skill_level_min   skill_level_enum,
  skill_level_max   skill_level_enum,
  estimated_minutes integer,
  published         boolean NOT NULL DEFAULT false
);

CREATE TABLE learning_path_entry (
  path_id    uuid REFERENCES learning_path(id) ON DELETE CASCADE,
  entry_id   uuid REFERENCES entry(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (path_id, entry_id)
);

-- Contribution
CREATE TABLE contribution (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            contribution_type_enum NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  payload         jsonb NOT NULL,
  entry_id        uuid REFERENCES entry(id),
  submitter_email text,
  reviewer_note   text,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz
);

-- User
CREATE TABLE "user" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  name          text NOT NULL,
  role          user_role_enum NOT NULL DEFAULT 'editor',
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

---

*Companion documents: 01-project-vision.md · 02-features.md · 04-technical-architecture.md*
