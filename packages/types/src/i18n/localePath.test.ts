import { describe, expect, it } from "vitest";
import { localePath } from "./localePath.js";
import {
  DEFAULT_LOCALE,
  PAGE_KEYS,
  PATH_SEGMENTS,
  SEGMENT_TO_CANONICAL,
  SUPPORTED_LOCALES,
} from "./segments.js";

// ---------------------------------------------------------------------------
// localePath — no slug
// ---------------------------------------------------------------------------

describe("localePath — no slug", () => {
  it("returns /{locale}/{segment} for every locale × page combination", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const page of PAGE_KEYS) {
        const expected = `/${locale}/${PATH_SEGMENTS[locale][page]}`;
        expect(localePath(locale, page)).toBe(expected);
      }
    }
  });

  it("English segments equal the canonical page key", () => {
    for (const page of PAGE_KEYS) {
      expect(localePath("en", page)).toBe(`/en/${page}`);
    }
  });

  it("Polish segments are translated (not the canonical key)", () => {
    expect(localePath("pl", "entries")).toBe("/pl/wpisy");
    expect(localePath("pl", "entry")).toBe("/pl/haslo");
    expect(localePath("pl", "articles")).toBe("/pl/artykuly");
    expect(localePath("pl", "article")).toBe("/pl/artykul");
    expect(localePath("pl", "learn")).toBe("/pl/nauka");
    expect(localePath("pl", "search")).toBe("/pl/szukaj");
    expect(localePath("pl", "map")).toBe("/pl/mapa");
    expect(localePath("pl", "country")).toBe("/pl/kraj");
    expect(localePath("pl", "contribute")).toBe("/pl/dodaj");
  });
});

// ---------------------------------------------------------------------------
// localePath — with slug
// ---------------------------------------------------------------------------

describe("localePath — with slug", () => {
  it("appends the slug as the final segment", () => {
    expect(localePath("en", "entry", "yarn-over")).toBe("/en/entry/yarn-over");
    expect(localePath("pl", "entry", "nawijak")).toBe("/pl/haslo/nawijak");
  });

  it("appends slug for every locale × page combination", () => {
    const slug = "test-slug";
    for (const locale of SUPPORTED_LOCALES) {
      for (const page of PAGE_KEYS) {
        const expected = `/${locale}/${PATH_SEGMENTS[locale][page]}/${slug}`;
        expect(localePath(locale, page, slug)).toBe(expected);
      }
    }
  });

  it("treats empty string slug the same as no slug", () => {
    expect(localePath("en", "entries", "")).toBe("/en/entries");
    expect(localePath("pl", "entries", "")).toBe("/pl/wpisy");
  });

  it("preserves slugs with special characters", () => {
    expect(localePath("pl", "entry", "ścieg-brioche")).toBe("/pl/haslo/ścieg-brioche");
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_LOCALE
// ---------------------------------------------------------------------------

describe("DEFAULT_LOCALE", () => {
  it("is a supported locale", () => {
    expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
  });

  it("is 'en'", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });
});

// ---------------------------------------------------------------------------
// SEGMENT_TO_CANONICAL — round-trip
// ---------------------------------------------------------------------------

describe("SEGMENT_TO_CANONICAL", () => {
  it("maps every locale segment back to its canonical page key", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const page of PAGE_KEYS) {
        const segment = PATH_SEGMENTS[locale][page];
        expect(SEGMENT_TO_CANONICAL[segment]).toBe(page);
      }
    }
  });

  it("covers all page keys for all locales (no missing entries)", () => {
    const expectedCount = SUPPORTED_LOCALES.length * PAGE_KEYS.length;
    // Unique segment strings (English and Polish may share some — they don't here,
    // but the map must have at least one entry per page key)
    const coveredKeys = new Set(Object.values(SEGMENT_TO_CANONICAL));
    expect(coveredKeys.size).toBe(PAGE_KEYS.length);
    // Total entries in the map equals unique segments across all locales
    expect(Object.keys(SEGMENT_TO_CANONICAL).length).toBeLessThanOrEqual(expectedCount);
  });

  it("round-trips: segment → canonical → segment for every locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const page of PAGE_KEYS) {
        const segment = PATH_SEGMENTS[locale][page];
        const canonical = SEGMENT_TO_CANONICAL[segment];
        // canonical must be defined
        expect(canonical).toBeDefined();
        // and must map back to the same segment in the original locale
        expect(PATH_SEGMENTS[locale][canonical!]).toBe(segment);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// PATH_SEGMENTS — structural invariants
// ---------------------------------------------------------------------------

describe("PATH_SEGMENTS", () => {
  it("every locale has an entry for every page key", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const page of PAGE_KEYS) {
        expect(PATH_SEGMENTS[locale][page]).toBeTruthy();
      }
    }
  });

  it("all segment strings are non-empty lowercase URL-safe strings", () => {
    const urlSafe = /^[a-z\u00C0-\u024F0-9-]+$/;
    for (const locale of SUPPORTED_LOCALES) {
      for (const page of PAGE_KEYS) {
        const segment = PATH_SEGMENTS[locale][page];
        expect(segment.length).toBeGreaterThan(0);
        expect(urlSafe.test(segment)).toBe(true);
      }
    }
  });
});
