/**
 * Brand color palette for the Knitovia admin panel.
 *
 * Each color slot has a `bg` (background) and `fg` (foreground/icon/text) value.
 * These are used consistently across categories, tags, entry-type badges,
 * icon boxes, info panels, and any other colored UI element.
 *
 * To change a color everywhere in the app — edit it here only.
 */

export interface ColorSlot {
  /** Hex background color */
  bg: string;
  /** Hex foreground color (text, icon) */
  fg: string;
  /** Human-readable name for the color picker */
  label: string;
}

export const APP_COLORS = {
  violet: { bg: '#EDE7FF', fg: '#7F6BBF', label: 'Violet' },
  peach:  { bg: '#FEF4EA', fg: '#E3972F', label: 'Peach'  },
  red:    { bg: '#FDEAEA', fg: '#C33636', label: 'Red'     },
  green:  { bg: '#ECF9EF', fg: '#47A555', label: 'Green'   },
  blue:   { bg: '#EBF5FF', fg: '#478ED5', label: 'Blue'    },
  cyan:   { bg: '#ECFBFD', fg: '#41BCCC', label: 'Cyan'    },
  pink:   { bg: '#FDECFC', fg: '#DC68D8', label: 'Pink'    },
  grey:   { bg: '#DEDEDE', fg: '#A1A0A0', label: 'Grey'    },
} as const satisfies Record<string, ColorSlot>;

export type AppColorKey = keyof typeof APP_COLORS;

/** Ordered array — used for color pickers and random selection */
export const APP_COLOR_LIST = Object.values(APP_COLORS);

/** Just the background hex values — for simple palette arrays */
export const APP_COLOR_BG_LIST = APP_COLOR_LIST.map((c) => c.bg) as string[];

/**
 * Pick a random color slot from the palette.
 * Used when creating a new category/tag without an explicit color choice.
 */
export function randomAppColor(): ColorSlot {
  return APP_COLOR_LIST[Math.floor(Math.random() * APP_COLOR_LIST.length)] ?? APP_COLORS.violet;
}

/**
 * Resolve a ColorSlot from a stored background hex string.
 * Falls back to the violet slot if the hex isn't found in the palette.
 */
export function colorSlotFromBg(bg: string | null | undefined): ColorSlot {
  const found = APP_COLOR_LIST.find((c) => c.bg.toLowerCase() === (bg ?? '').toLowerCase());
  return found ?? APP_COLORS.violet;
}

/**
 * Return inline style props `{ backgroundColor, color }` for a given bg hex.
 * Convenient for components that accept a `style` prop.
 */
export function colorStyle(bg: string | null | undefined): { backgroundColor: string; color: string } {
  const slot = colorSlotFromBg(bg);
  return { backgroundColor: slot.bg, color: slot.fg };
}
