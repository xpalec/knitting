/**
 * Prisma seed — minimal bootstrap data
 * 5 BlockTemplates + 3 entries (en + pl translations each)
 * Run: pnpm prisma db seed
 */
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const blk = (id: string, type: string, order: number, extra: object = {}) =>
  ({ id, type, order, visible: true, ...extra });

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const steps = (name: string, difficulty: string, list: string[]) => ({
  name, difficulty,
  steps: list.map((text, i) => ({ order: i + 1, text })),
});

// ---------------------------------------------------------------------------
// Block Templates (one per entry type)
// ---------------------------------------------------------------------------
const TEMPLATES = [
  { entry_type: 'stitch',      blocks: [blk('def',1,'definition'), blk('tech',2,'technique'), blk('callout',3,'callout',{variant:'tip'}), blk('related',4,'related'), blk('pattern',5,'pattern_usage')] },
  { entry_type: 'technique',   blocks: [blk('def',1,'definition'), blk('tech1',2,'technique'), blk('tech2',3,'technique'), blk('related',4,'related')] },
  { entry_type: 'tool',        blocks: [blk('def',1,'definition'), blk('callout',2,'callout',{variant:'tip'}), blk('related',3,'related')] },
  { entry_type: 'tradition',   blocks: [blk('def',1,'definition'), blk('tech',2,'technique'), blk('related',3,'related'), blk('pattern',4,'pattern_usage')] },
  { entry_type: 'yarn_weight', blocks: [blk('def',1,'definition'), blk('callout',2,'callout',{variant:'tip'}), blk('related',3,'related')] },
];

// ---------------------------------------------------------------------------
// Seed entries — 3 entries, en + pl each
// ---------------------------------------------------------------------------
async function main() {
  console.log('Seeding...');

  // Block templates
  for (const t of TEMPLATES) {
    await prisma.blockTemplate.upsert({
      where: { entry_type: t.entry_type },
      update: { blocks: t.blocks },
      create: { entry_type: t.entry_type, blocks: t.blocks },
    });
  }
  console.log(`  ${TEMPLATES.length} BlockTemplate rows`);

  // Entry 1 — Yarn Over (en origin)
  const yo = await prisma.entry.create({
    data: {
      origin_language: 'en',
      status: 'published',
      metadata: { skill_level: 'beginner', definition_short: 'Wrap yarn over the needle to create a new stitch.' },
      content_blocks: [
        blk('yo-def', 'definition', 1),
        blk('yo-tech', 'technique', 2),
        blk('yo-callout', 'callout', 3, { variant: 'tip' }),
        blk('yo-related', 'related', 4),
      ],
      published_at: new Date(),
    },
  });
  await prisma.translation.createMany({ data: [
    { entry_id: yo.id, locale: 'en', slug: 'yarn-over', term: 'Yarn Over',
      metadata: { abbreviation: 'yo', definition_short: 'Wrap yarn over the needle to create a new stitch.' },
      blocks: {
        'yo-def': doc('A yarn over (yo) wraps the yarn over the right needle, creating an extra loop that becomes a new stitch on the next row.'),
        'yo-tech': steps('Basic Yarn Over', 'beginner', ['Bring yarn to the front between the needles.', 'Wrap yarn over the right needle from front to back.', 'Continue knitting — the wrap becomes a new stitch.']),
        'yo-callout': { text: 'US "yo" = UK "yfwd" (yarn forward). Same action, different name.' },
      },
      status: 'published' },
    { entry_id: yo.id, locale: 'pl', slug: 'nawijak', term: 'Nawijak',
      metadata: { abbreviation: 'nw', definition_short: 'Owinięcie nitki wokół drutów tworzące nowe oczko.' },
      blocks: {
        'yo-def': doc('Nawijak (nw) owija nitkę wokół prawego drutu, tworząc dodatkową pętelkę, która staje się nowym oczkiem w następnym rzędzie.'),
        'yo-tech': steps('Podstawowy nawijak', 'beginner', ['Przesuń nitkę na przód między drutami.', 'Owiń nitkę wokół prawego drutu od przodu do tyłu.', 'Kontynuuj robótkę — owinięcie staje się nowym oczkiem.']),
        'yo-callout': { text: 'Angielskie "yo" odpowiada brytyjskiemu "yfwd". Ta sama czynność, inna nazwa.' },
      },
      status: 'published' },
  ]});

  // Entry 2 — Knit Two Together (en origin)
  const k2tog = await prisma.entry.create({
    data: {
      origin_language: 'en',
      status: 'published',
      metadata: { skill_level: 'beginner', definition_short: 'Knit two stitches together as one to decrease stitch count.' },
      content_blocks: [
        blk('k2tog-def', 'definition', 1),
        blk('k2tog-tech', 'technique', 2),
        blk('k2tog-related', 'related', 3),
      ],
      published_at: new Date(),
    },
  });
  await prisma.translation.createMany({ data: [
    { entry_id: k2tog.id, locale: 'en', slug: 'knit-two-together', term: 'Knit Two Together',
      metadata: { abbreviation: 'k2tog', definition_short: 'Knit two stitches together as one to decrease stitch count.' },
      blocks: {
        'k2tog-def': doc('K2tog is a right-leaning decrease — insert the needle through two stitches simultaneously and knit them as one.'),
        'k2tog-tech': steps('K2tog', 'beginner', ['Insert right needle knitwise through the next two stitches.', 'Wrap yarn and pull through both stitches.', 'Slip both stitches off the left needle.']),
      },
      status: 'published' },
    { entry_id: k2tog.id, locale: 'pl', slug: 'dwa-razem', term: 'Dwa razem',
      metadata: { abbreviation: '2r', definition_short: 'Zdzierganie dwóch oczek razem jako jedno zmniejszenie.' },
      blocks: {
        'k2tog-def': doc('Dwa razem (2r) to zmniejszenie pochylone w prawo — wkłada się drut przez dwa oczka jednocześnie i zdzierguje je jako jedno.'),
        'k2tog-tech': steps('Dwa razem', 'beginner', ['Wsuń prawy drut przez dwa kolejne oczka na lewym drucie.', 'Owiń nitkę i przeciągnij przez oba oczka.', 'Zdejmij oba oczka z lewego drutu.']),
      },
      status: 'published' },
  ]});

  // Entry 3 — Brioche Stitch (pl origin)
  const brioche = await prisma.entry.create({
    data: {
      origin_language: 'pl',
      status: 'published',
      metadata: { skill_level: 'intermediate', definition_short: 'A reversible rib stitch with a distinctive squishy texture.' },
      content_blocks: [
        blk('br-def', 'definition', 1),
        blk('br-tech', 'technique', 2),
        blk('br-callout', 'callout', 3, { variant: 'tip' }),
        blk('br-related', 'related', 4),
      ],
      published_at: new Date(),
    },
  });
  await prisma.translation.createMany({ data: [
    { entry_id: brioche.id, locale: 'en', slug: 'brioche-stitch', term: 'Brioche Stitch',
      metadata: { definition_short: 'A reversible rib stitch with a distinctive squishy texture.' },
      blocks: {
        'br-def': doc('Brioche stitch creates a squishy, reversible fabric by combining yarn-overs with slipped stitches on every row.'),
        'br-tech': steps('One-Colour Brioche', 'intermediate', ['Set-up row: *sl1yo, k1; repeat from *.', 'Every row: *brk, sl1yo; repeat from *.']),
        'br-callout': { text: 'Brioche uses ~50% more yarn than stockinette — swatch before buying yarn.' },
      },
      status: 'published' },
    { entry_id: brioche.id, locale: 'pl', slug: 'scieg-brioche', term: 'Ścieg brioche',
      metadata: { abbreviation: 'br', definition_short: 'Dwustronny ścieg żebrowy o charakterystycznej puszystej fakturze.' },
      blocks: {
        'br-def': doc('Ścieg brioche tworzy puszystą, dwustronną tkaninę przez łączenie nawijaków z przesuniętymi oczkami w każdym rzędzie.'),
        'br-tech': steps('Jednokolorowe brioche', 'intermediate', ['Rząd przygotowawczy: *przesuń 1 z nawijakiem, 1 prawe; powtarzaj od *.', 'Każdy rząd: *brk, przesuń 1 z nawijakiem; powtarzaj od *.']),
        'br-callout': { text: 'Brioche zużywa ok. 50% więcej nitki niż ścieg gładki — zrób próbkę przed zakupem włóczki.' },
      },
      status: 'published' },
  ]});

  console.log('  3 Entry rows, 6 Translation rows');

  // Verify trigger populated search_vector
  const result = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM translation WHERE search_vector IS NOT NULL
  `;
  console.log(`  search_vector populated on ${result[0].count} Translation rows`);

  // Users
  for (const u of USERS) {
    const password_hash = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        role: u.role as never,
        password_hash,
      },
    });
  }
  console.log(`  ${USERS.length} User rows (admin@knitting.local / admin123, editor@knitting.local / editor123)`);

  console.log('Done.');
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const USERS = [
  { email: 'admin@knitting.local',  name: 'Admin',        role: 'admin',    password: 'admin123' },
  { email: 'editor@knitting.local', name: 'Editor',       role: 'editor',   password: 'editor123' },
];

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
