// ---------------------------------------------------------------------------
// Frontend-only block type registry
// Defines available block types and their translatable field schemas.
// Add new entries here to support more block types — no component changes needed.
// ---------------------------------------------------------------------------

export interface BlockTypeField {
  name: string;       // e.g. "heading"
  label: string;      // e.g. "Header"
  maxLength: number;  // e.g. 255
}

export interface BlockTypeDescriptor {
  slug: string;               // e.g. "rich_text"
  label: string;              // e.g. "Rich Text"
  color: string;              // accent color hex for UI indicators
  translatableFields: BlockTypeField[];
}

export const BLOCK_TYPES: BlockTypeDescriptor[] = [
  {
    slug: 'rich_text',
    label: 'Rich Text',
    color: '#EDE9FE',
    translatableFields: [
      { name: 'heading', label: 'Header', maxLength: 255 },
    ],
  },
  {
    slug: 'callout',
    label: 'Callout',
    color: '#FEF9C3',
    translatableFields: [
      { name: 'heading', label: 'Header', maxLength: 255 },
    ],
  },
  {
    slug: 'steps',
    label: 'Steps',
    color: '#DCFCE7',
    translatableFields: [
      { name: 'heading', label: 'Header', maxLength: 255 },
    ],
  },
  {
    slug: 'key_facts',
    label: 'Key Facts',
    color: '#DBEAFE',
    translatableFields: [
      { name: 'heading', label: 'Header', maxLength: 255 },
    ],
  },
  {
    slug: 'video',
    label: 'Video',
    color: '#FCE7F3',
    translatableFields: [
      { name: 'heading', label: 'Header', maxLength: 255 },
    ],
  },
  {
    slug: 'image',
    label: 'Image',
    color: '#E0F2FE',
    translatableFields: [
      { name: 'heading', label: 'Header', maxLength: 255 },
    ],
  },
  {
    slug: 'relations',
    label: 'Relations',
    color: '#F3E8FF',
    translatableFields: [
      { name: 'heading', label: 'Header', maxLength: 255 },
    ],
  },
  {
    slug: 'pattern',
    label: 'Pattern Usage',
    color: '#FEF3C7',
    translatableFields: [
      { name: 'heading', label: 'Header', maxLength: 255 },
    ],
  },
];

export function getBlockType(slug: string): BlockTypeDescriptor | undefined {
  return BLOCK_TYPES.find((bt) => bt.slug === slug);
}
