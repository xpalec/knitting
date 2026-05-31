# Feature list — European Knitting Encyclopedia

## Notes on this document

This document lists all planned features grouped by website section. Each feature is marked with a launch priority:

- `[LAUNCH]` — required at launch
- `[SOON]` — planned shortly after launch
- `[LATER]` — future roadmap item

The website is desktop-first. The UI language is English. Entry content, definitions, and articles are available in multiple languages (Polish, Norwegian, German, French, English). User accounts are not scoped for launch — contribution workflow is defined but account model is deferred.

---

## 1. Landing page

The public front door of the encyclopedia. Introduces the project and guides users into the right section via a tile grid.

### Hero section
- `[LAUNCH]` Full-width hero with project name, one-line description, and a prominent search box
- `[LAUNCH]` Search box performs live search across entry terms in all languages simultaneously
- `[LAUNCH]` Search results surface the user's detected browser language first, with other locales below
- `[SOON]` "Entry of the day" highlight beneath the hero — a featured entry with definition and origin

### Navigation tile grid (7 tiles)
- `[LAUNCH]` **Explore by country / language** — entry point to country- and language-specific content; shows flags or country names; routes to the country landing page
- `[LAUNCH]` **Entry dictionary** — routes to the full paginated, filterable entry list
- `[LAUNCH]` **Articles & editorial** — routes to the articles index
- `[LAUNCH]` **Traditions map** — routes to the interactive European map
- `[LAUNCH]` **Learn** — routes to structured learning paths
- `[LAUNCH]` **Community contributions** — routes to the entry submission and translation contribution forms
- `[LATER]` **Patterns** — routes to the pattern browser (post-launch)

### Footer
- `[LAUNCH]` Links to About, Editorial policy, Contribute, Contact
- `[LAUNCH]` Language selector for entry browsing language (does not change UI language)
- `[LAUNCH]` Brief project description and open-access statement

---

## 2. Explore by country / language

A dedicated landing page per country or linguistic tradition. Accessible from the landing tile and from the traditions map.

### Country landing page
- `[LAUNCH]` One page per supported country / tradition: Poland, Norway, Germany / Austria, UK / Ireland, France
- `[LAUNCH]` Short editorial introduction to the knitting tradition of that country (1–3 paragraphs)
- `[LAUNCH]` Featured entries from that country's tradition, shown as cards with term, short definition, and skill level badge
- `[LAUNCH]` Link to filtered entry list showing only entries associated with that country
- `[LAUNCH]` Link to articles tagged with that country
- `[SOON]` Country-specific timeline — key moments in the knitting history of that region
- `[SOON]` Featured article spotlight — the most recent long-form article about that tradition
- `[LATER]` Community statistics — number of entries, translations, and contributors for that language

### Language selector behaviour
- `[LAUNCH]` Selecting a country / language sets the active browsing locale — all entry definitions, lists, and search results prefer that locale until changed
- `[LAUNCH]` Locale preference stored in browser (localStorage) — persists across sessions without requiring an account

---

## 3. Entry dictionary

The core reference section of the encyclopedia. A paginated, searchable, filterable list of all entries.

### Entry list page
- `[LAUNCH]` Paginated list of entries, default 20 per page
- `[LAUNCH]` Sorted alphabetically in the active locale's language (locale-aware collation — handles ą, ę, ó, ś, ź etc. correctly for Polish; ä, ö, ü for German, etc.)
- `[LAUNCH]` Alphabetical dividers grouping entries by first letter in the active locale
- `[LAUNCH]` Each row shows: term, abbreviation, definition preview (truncated), skill level badge, category badge, and tag badges
- `[LAUNCH]` Entries missing a translation in the active locale show the English canonical term in muted style with a "no [language] translation yet" label
- `[LAUNCH]` Filter bar: free-text search within the current locale, skill level filter, category filter, tag filter
- `[LAUNCH]` Sort toggle: alphabetical (A → Z) or by skill level
- `[SOON]` Filter by country / tradition of origin
- `[SOON]` Filter by media availability (entries with video, entries with diagram)
- `[LATER]` Keyset pagination for performance on large entry counts (replaces OFFSET-based pagination)
- `[LATER]` Export current filtered list as CSV or PDF

### Category browsing
- `[LAUNCH]` Category index page listing all top-level categories with entry counts
- `[LAUNCH]` Each category page shows its subcategories and the entrys within them
- `[LAUNCH]` Breadcrumb navigation showing position in the category hierarchy
- `[SOON]` Category page includes an editorial introduction (e.g. "About lace knitting")

### Tag browsing
- `[LAUNCH]` Tag index page listing all published tags with translated names and entry counts
- `[LAUNCH]` Each tag page shows all entries tagged with it, paginated and locale-aware
- `[LAUNCH]` Tag page includes translated name, description (rich text), and correct SEO title/description per locale
- `[LAUNCH]` Tag badges on entry list rows and entry detail pages link to the tag page

---

## 4. Entry detail page

The individual encyclopedia entry — the most content-rich page on the site.

### Core content
- `[LAUNCH]` Canonical English term, slug-based URL (e.g. `/entry/yarn-over`)
- `[LAUNCH]` Term in the active locale with abbreviation
- `[LAUNCH]` Full definition in the active locale (falls back to English if no translation exists)
- `[LAUNCH]` Skill level badge, category breadcrumb, origin country badge
- `[LAUNCH]` Language switcher — view this entry in any available locale
- `[LAUNCH]` Abbreviation(s) listed with regional attribution (US, UK, PL, etc.)

### Related content
- `[LAUNCH]` Related entries section — synonyms, antonyms, prerequisites, regional variants, broader/narrower terms; each shown as a labelled link card
- `[LAUNCH]` "Used in patterns" section — list of patterns that use this entry with context note and frequency bar
- `[SOON]` "Also known as" section surfacing all locale-specific terms for this entry in a comparison table

### Techniques
- `[LAUNCH]` One or more technique blocks, each with: technique name, difficulty, step-by-step instructions
- `[SOON]` Video clip embedded per technique (hosted externally, e.g. YouTube / Vimeo)

### Media
- `[LAUNCH]` Image gallery — photos and diagrams with captions and alt text
- `[SOON]` Video clips with locale-specific captions
- `[LATER]` Downloadable stitch diagram (PDF or SVG)

### Editorial
- `[LAUNCH]` "Suggest a correction" link — opens a lightweight form pre-filled with the entry slug
- `[SOON]` Last reviewed date and editorial status indicator
- `[LATER]` Change history / version log visible to logged-in contributors

---

## 5. Articles & editorial

Long-form content about techniques, history, traditions, and the stories behind knitting entrys.

### Article index page
- `[LAUNCH]` Grid of article cards — title, cover image, author, publication date, estimated reading time, tags
- `[LAUNCH]` Filter by tag (technique, history, tradition, country)
- `[LAUNCH]` Filter by country / tradition
- `[SOON]` Featured article hero at the top of the index
- `[SOON]` "Related articles" sidebar on each article page

### Article detail page
- `[LAUNCH]` Full article with rich text formatting (headings, pull quotes, images, embedded entry cards)
- `[LAUNCH]` Inline entry cards — when a knitting term is mentioned in an article, it can be rendered as a mini entry card (term, definition preview, link to full entry page)
- `[LAUNCH]` Tags and country attribution
- `[LAUNCH]` Author credit
- `[SOON]` Related entries list at the bottom of the article
- `[LATER]` Article available in multiple languages (same editorial workflow as entry translations)

---

## 6. Traditions map

An interactive map of Europe allowing users to explore knitting traditions by geography.

- `[LAUNCH]` Clickable SVG or canvas map of Europe; each country / region is a clickable zone
- `[LAUNCH]` Hovering a country shows: country name, number of entries, number of traditions, one featured entry
- `[LAUNCH]` Clicking a country navigates to the country landing page
- `[SOON]` Regional granularity — sub-national regions where traditions differ significantly (e.g. Shetland vs mainland Scotland, Podhale vs rest of Poland)
- `[SOON]` Toggle layer: "show origin countries" — colours countries by number of entry origins
- `[LATER]` Toggle layer: "show tradition spread" — shows how a technique travelled across borders (e.g. Fair Isle influence on Norwegian colorwork)

---

## 7. Learn

Structured learning paths that guide users through knitting vocabulary from beginner to advanced, built from existing entry content.

### Learning path index
- `[LAUNCH]` Index of available learning paths, each with title, skill level range, estimated time, and entry count
- `[LAUNCH]` Example paths at launch: "Essential beginner terms", "Reading a knitting pattern", "Understanding lace vocabulary", "Nordic colorwork terminology"

### Learning path page
- `[LAUNCH]` Ordered list of entries forming the path, shown as step cards
- `[LAUNCH]` Progress indicator — how many entries in this path the user has viewed
- `[LAUNCH]` Each step card shows: term, definition, skill badge, link to full entry page
- `[SOON]` "Mark as learned" per entry (stored in localStorage, no account required)
- `[SOON]` Path completion indicator
- `[LATER]` User-created paths (requires account)
- `[LATER]` Paths available in multiple languages

---

## 8. Community contributions

The public-facing workflow for submitting new entrys, translations, and corrections.

### Entry submission
- `[LAUNCH]` Public form to submit a new entry: term, definition, category, skill level, origin country, abbreviation (optional)
- `[LAUNCH]` Submission goes into an editorial review queue — not published until approved
- `[LAUNCH]` Submitter can optionally leave an email address for notification when their submission is reviewed (no account required)
- `[SOON]` Duplicate detection — warn the submitter if an entry with the same term already exists

### Translation contribution
- `[LAUNCH]` On any entry detail page, a "Contribute translation" button opens a form pre-filled with the entry slug and prompts for: locale, translated term, translated definition, abbreviation in that locale
- `[LAUNCH]` Translation submissions enter the same editorial review queue
- `[SOON]` Contributor can see the status of their pending submissions via a link sent by email (no account required)

### Correction reporting
- `[LAUNCH]` "Suggest a correction" link on every entry page — lightweight form with: field being corrected, current value, suggested value, optional note
- `[LAUNCH]` Corrections flagged separately from new submissions in the editorial queue

### Editorial review queue (internal)
- `[LAUNCH]` Admin-only interface listing all pending submissions, translations, and corrections
- `[LAUNCH]` Approve / reject / edit each submission with an optional reviewer note
- `[LAUNCH]` Approved submissions publish immediately; rejected submissions are archived with reason
- `[SOON]` Bulk approve for high-confidence translation submissions
- `[LATER]` Contributor accounts with submission history and notification preferences

---

## 9. Patterns (post-launch)

A browser of knitting patterns cross-referenced with encyclopedian entrys. Deferred to after launch.

- `[LATER]` Pattern index page with filters: garment type, skill level, tradition, country of origin
- `[LATER]` Pattern detail page showing which entries appear in the pattern, with context notes and frequency
- `[LATER]` From any entry page, "Used in patterns" expands to show full pattern metadata
- `[LATER]` Pattern submission form for community contributions

---

## 10. Search

Search is available from the landing page hero and from the persistent site header.

- `[LAUNCH]` Full-text search across entry terms in all supported locales simultaneously
- `[LAUNCH]` Results ranked: active locale matches first, then other locales, then English canonical
- `[LAUNCH]` Each result shows: matched term, locale badge, definition preview, entry slug link
- `[LAUNCH]` Search results page with filter by locale, category, skill level
- `[SOON]` Autocomplete / typeahead in the search box showing top 5 matches as you type
- `[SOON]` "Did you mean…" suggestions for near-miss queries (e.g. "masche" → "Masche")
- `[LATER]` Search within articles as well as entries
- `[LATER]` Search analytics (most searched terms, zero-result queries) visible to editors

---

## 11. Global / cross-cutting features

Features that apply across the whole website.

- `[LAUNCH]` Persistent header with: site name, search box, language selector, main navigation links
- `[LAUNCH]` Locale preference stored in browser — persists across all pages without an account
- `[LAUNCH]` All entry URLs are slug-based and stable — `/entry/yarn-over` never changes
- `[LAUNCH]` Every entry page and article is indexable by search engines (SSR or static generation)
- `[LAUNCH]` Accessible markup — semantic HTML, alt text on all images, keyboard-navigable
- `[LAUNCH]` Desktop-first responsive layout — fully usable on tablet and mobile but optimised for desktop
- `[SOON]` Open Graph / social sharing metadata on entry and article pages
- `[SOON]` RSS feed for new articles and newly published entries
- `[LATER]` API access for entry data (read-only, JSON) — to support future mobile app or third-party integrations
- `[LATER]` Mobile app (iOS / Android) — deferred, architecture supports it via API

---

*Document version: 1.0 — April 2026*
*Companion documents: 01-project-vision.md, knitting-encyclopedia-data-model.md*
