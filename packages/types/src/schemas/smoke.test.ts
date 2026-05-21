/**
 * Smoke tests — verify all schemas parse valid data correctly.
 * These are not exhaustive; they confirm the schemas are wired up and accept well-formed input.
 */

import { describe, expect, it } from "vitest";
import {
  ArticleSchema,
  CalloutBlockSchema,
  CategoryTreeSchema,
  ContributionSchema,
  DefinitionBlockSchema,
  EntryListItemSchema,
  EntrySchema,
  EntrySubmissionSchema,
  LearningPathDetailSchema,
  LoginSchema,
  MediaAssetSchema,
  MediaBlockSchema,
  TechniqueBlockSchema,
  TokenSchema,
  TranslationSchema,
  UserSchema,
} from "./index.js";

describe("EntrySchema", () => {
  it("parses a valid entry", () => {
    const result = EntrySchema.safeParse({
      id: "018e1234-5678-7abc-def0-123456789abc",
      origin_language: "pl",
      status: "published",
      metadata: { skill_level: "beginner", definition_short: "A yarn wrap." },
      content_blocks: [
        { id: "018e1234-5678-7abc-def0-000000000001", type: "definition", order: 1, visible: true },
        {
          id: "018e1234-5678-7abc-def0-000000000002",
          type: "media",
          order: 2,
          visible: true,
          assetId: "018e1234-5678-7abc-def0-000000000003",
        },
        {
          id: "018e1234-5678-7abc-def0-000000000004",
          type: "callout",
          order: 3,
          visible: false,
          variant: "tip",
        },
      ],
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      published_at: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an entry with an unsupported origin_language", () => {
    const result = EntrySchema.safeParse({
      id: "018e1234-5678-7abc-def0-123456789abc",
      origin_language: "ja", // not supported
      status: "draft",
      metadata: {},
      content_blocks: [],
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      published_at: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an entry with no origin_language", () => {
    const result = EntrySchema.safeParse({
      id: "018e1234-5678-7abc-def0-123456789abc",
      status: "draft",
      metadata: {},
      content_blocks: [],
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      published_at: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("ContentBlockSchema — discriminated union", () => {
  it("parses a definition block", () => {
    const r = DefinitionBlockSchema.safeParse({
      id: "018e1234-5678-7abc-def0-000000000001",
      type: "definition",
      order: 1,
      visible: true,
    });
    expect(r.success).toBe(true);
  });

  it("parses a technique block", () => {
    const r = TechniqueBlockSchema.safeParse({
      id: "018e1234-5678-7abc-def0-000000000002",
      type: "technique",
      order: 2,
      visible: true,
    });
    expect(r.success).toBe(true);
  });

  it("parses a media block with assetId", () => {
    const r = MediaBlockSchema.safeParse({
      id: "018e1234-5678-7abc-def0-000000000003",
      type: "media",
      order: 3,
      visible: true,
      assetId: "018e1234-5678-7abc-def0-000000000099",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a media block missing assetId", () => {
    const r = MediaBlockSchema.safeParse({
      id: "018e1234-5678-7abc-def0-000000000003",
      type: "media",
      order: 3,
      visible: true,
    });
    expect(r.success).toBe(false);
  });

  it("parses a callout block with variant", () => {
    const r = CalloutBlockSchema.safeParse({
      id: "018e1234-5678-7abc-def0-000000000004",
      type: "callout",
      order: 4,
      visible: true,
      variant: "warning",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a callout block with invalid variant", () => {
    const r = CalloutBlockSchema.safeParse({
      id: "018e1234-5678-7abc-def0-000000000004",
      type: "callout",
      order: 4,
      visible: true,
      variant: "info", // not in enum
    });
    expect(r.success).toBe(false);
  });
});

describe("TranslationSchema", () => {
  it("parses a valid translation", () => {
    const r = TranslationSchema.safeParse({
      id: "018e1234-5678-7abc-def0-aaaaaaaaaaaa",
      entry_id: "018e1234-5678-7abc-def0-123456789abc",
      locale: "pl",
      slug: "nawijak",
      term: "Nawijak",
      metadata: { abbreviation: "nw", definition_short: "Owinięcie nitki wokół drutu." },
      blocks: {
        "018e1234-5678-7abc-def0-000000000001": {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Opis." }] }],
        },
      },
      translator_note: null,
      status: "published",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a translation with definition_short over 160 chars", () => {
    const r = TranslationSchema.safeParse({
      id: "018e1234-5678-7abc-def0-aaaaaaaaaaaa",
      entry_id: "018e1234-5678-7abc-def0-123456789abc",
      locale: "en",
      slug: "yarn-over",
      term: "Yarn over",
      metadata: { definition_short: "x".repeat(161) },
      blocks: {},
      translator_note: null,
      status: "draft",
    });
    expect(r.success).toBe(false);
  });
});

describe("EntryListItemSchema", () => {
  it("parses a list item with missing_translation flag", () => {
    const r = EntryListItemSchema.safeParse({
      id: "018e1234-5678-7abc-def0-123456789abc",
      origin_language: "no",
      status: "published",
      skill_level: "intermediate",
      term: "Yarn over",
      abbreviation: "yo",
      definition_short: "A yarn wrap.",
      missing_translation: true,
      locale: "de",
      slug: "yarn-over",
    });
    expect(r.success).toBe(true);
  });
});

describe("CategoryTreeSchema", () => {
  it("parses a nested category tree", () => {
    const r = CategoryTreeSchema.safeParse({
      id: "018e1234-5678-7abc-def0-cccccccccccc",
      name: "Stitches",
      slug: "stitches",
      parent_id: null,
      icon: null,
      sort_order: 0,
      entry_count: 42,
      children: [
        {
          id: "018e1234-5678-7abc-def0-dddddddddddd",
          name: "Increases",
          slug: "increases",
          parent_id: "018e1234-5678-7abc-def0-cccccccccccc",
          icon: null,
          sort_order: 1,
          children: [],
        },
      ],
    });
    expect(r.success).toBe(true);
  });
});

describe("ArticleSchema", () => {
  it("parses a valid article", () => {
    const r = ArticleSchema.safeParse({
      id: "018e1234-5678-7abc-def0-eeeeeeeeeeee",
      slug: "history-of-fair-isle",
      title: "History of Fair Isle Knitting",
      content: { type: "doc", content: [{ type: "paragraph" }] },
      cover_image_url: null,
      author: "Jane Smith",
      country_code: "gb",
      reading_time_minutes: 8,
      status: "published",
      published_at: "2026-03-01T10:00:00.000Z",
      created_at: "2026-02-01T00:00:00.000Z",
      updated_at: "2026-03-01T10:00:00.000Z",
    });
    expect(r.success).toBe(true);
  });
});

describe("EntrySubmissionSchema", () => {
  it("parses a valid submission", () => {
    const r = EntrySubmissionSchema.safeParse({
      term: "Yarn over",
      definition: "A technique where you wrap the yarn around the needle to create a new stitch.",
      origin_language: "en",
      skill_level: "beginner",
      abbreviation: "yo",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a submission with too-short definition", () => {
    const r = EntrySubmissionSchema.safeParse({
      term: "yo",
      definition: "Short",
      origin_language: "en",
    });
    expect(r.success).toBe(false);
  });
});

describe("LearningPathDetailSchema", () => {
  it("parses a path with entries", () => {
    const r = LearningPathDetailSchema.safeParse({
      id: "018e1234-5678-7abc-def0-ffffffffffff",
      slug: "beginner-basics",
      title: "Beginner Basics",
      description: "Start here.",
      skill_level_min: "beginner",
      skill_level_max: "intermediate",
      estimated_minutes: 60,
      published: true,
      entries: [
        {
          sort_order: 1,
          entry_id: "018e1234-5678-7abc-def0-123456789abc",
          term: "Knit stitch",
          definition_short: "The basic knit stitch.",
          skill_level: "beginner",
          slug: "knit-stitch",
          locale: "en",
        },
      ],
    });
    expect(r.success).toBe(true);
  });
});

describe("MediaAssetSchema", () => {
  it("parses a valid asset — no alt_text or caption", () => {
    const r = MediaAssetSchema.safeParse({
      id: "018e1234-5678-7abc-def0-111111111111",
      entry_id: "018e1234-5678-7abc-def0-123456789abc",
      type: "diagram",
      url: "https://media.knitting.example.com/yarn-over.png",
      sort_order: 0,
    });
    expect(r.success).toBe(true);
  });
});

describe("UserSchema", () => {
  it("parses a valid user", () => {
    const r = UserSchema.safeParse({
      id: "018e1234-5678-7abc-def0-222222222222",
      email: "editor@knitting.example.com",
      name: "Anna Kowalska",
      role: "editor",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an invalid role", () => {
    const r = UserSchema.safeParse({
      id: "018e1234-5678-7abc-def0-222222222222",
      email: "editor@knitting.example.com",
      name: "Anna Kowalska",
      role: "superadmin", // not in enum
      created_at: "2026-01-01T00:00:00.000Z",
    });
    expect(r.success).toBe(false);
  });
});

describe("LoginSchema", () => {
  it("parses valid credentials", () => {
    const r = LoginSchema.safeParse({ email: "admin@knitting.example.com", password: "s3cr3tpass" });
    expect(r.success).toBe(true);
  });

  it("rejects a password shorter than 8 chars", () => {
    const r = LoginSchema.safeParse({ email: "admin@knitting.example.com", password: "short" });
    expect(r.success).toBe(false);
  });
});

describe("TokenSchema", () => {
  it("parses a valid token response", () => {
    const r = TokenSchema.safeParse({
      expires_at: "2026-06-01T00:00:00.000Z",
      user: {
        id: "018e1234-5678-7abc-def0-222222222222",
        name: "Anna Kowalska",
        email: "editor@knitting.example.com",
        role: "reviewer",
      },
    });
    expect(r.success).toBe(true);
  });
});

describe("ContributionSchema", () => {
  it("parses a pending entry contribution", () => {
    const r = ContributionSchema.safeParse({
      id: "018e1234-5678-7abc-def0-333333333333",
      type: "entry",
      status: "pending",
      payload: { term: "Yarn over", definition: "A wrap technique." },
      entry_id: null,
      submitter_email: null,
      reviewer_note: null,
      submitted_at: "2026-05-01T12:00:00.000Z",
      reviewed_at: null,
    });
    expect(r.success).toBe(true);
  });
});
