/**
 * Pure validation utilities — no React/DOM imports.
 * Used by all three editor forms (Article, Entry, Category) to enforce
 * locale-agnostic save/publish gating.
 */

/**
 * A locale-agnostic record of locale states.
 * Each value must have at least a title/name string and a slug string.
 */
export interface LocaleEntry {
  title?: string; // used by Article / Entry
  name?: string;  // used by Category
  slug: string;
}

/**
 * Returns true iff at least one locale has both its primary label
 * (title ?? name) and slug non-empty after trimming whitespace.
 *
 * Iterates over Object.values to be key-order-independent (Req 1.5).
 */
export function hasAtLeastOneCompleteLocale(
  locales: Record<string, LocaleEntry>,
): boolean {
  return Object.values(locales).some((entry) => {
    const label = (entry.title ?? entry.name ?? '').trim();
    const slug = entry.slug.trim();
    return label !== '' && slug !== '';
  });
}

/**
 * A pure function that checks form values and returns:
 *   null   — rule passes
 *   string — rule fails with this error message
 */
export type ValidationRule<T = Record<string, unknown>> = (values: T) => string | null;

/**
 * Factory: creates a ValidationRule that fails when values[fieldKey] is falsy
 * (empty string, null, or undefined).
 *
 * @param fieldKey - The key of the field to check in the form values object.
 * @param message  - Optional override for the default error message.
 */
export function requireField<T extends Record<string, unknown>>(
  fieldKey: keyof T & string,
  message?: string,
): ValidationRule<T> {
  return (values: T): string | null => {
    if (values[fieldKey]) {
      return null;
    }
    return message ?? `"${fieldKey}" is required.`;
  };
}

/** Minimal shape for a content block. */
export interface BlockLike {
  type: string;
  visible: boolean;
}

/** Constraint for form values that contain a blocks array. */
export interface WithBlocks {
  blocks: BlockLike[];
}

/**
 * Factory: creates a ValidationRule that fails when no block with the given
 * `type` and `visible: true` exists in values.blocks.
 *
 * @param blockType - The block type string to look for.
 * @param message   - Optional override for the default error message.
 */
export function requireBlockType<T extends WithBlocks>(
  blockType: string,
  message?: string,
): ValidationRule<T> {
  return (values: T): string | null => {
    const hasBlock = values.blocks.some(
      (block) => block.type === blockType && block.visible === true,
    );
    if (hasBlock) {
      return null;
    }
    return message ?? `A visible "${blockType}" block is required.`;
  };
}
