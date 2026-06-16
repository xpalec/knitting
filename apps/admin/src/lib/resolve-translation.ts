/**
 * Resolves a translated label for any entity that carries a `translations` array.
 *
 * Resolution order (three-tier):
 *   1. Find the translation whose `locale === activeLocale` — if found and the
 *      label extracted by `getLabel` is non-null/non-undefined/non-empty, use it
 *      with `isFallback: false`.
 *   2. Fall back to the translation whose `locale === "en"` — if found and the
 *      label is non-null, use it with `isFallback: true`.
 *   3. Fall back to `fallbackId` with `isFallback: true`.
 *
 * @param translations  The array of translation objects for the entity.
 * @param activeLocale  The currently selected locale code (e.g. `"pl"`).
 * @param getLabel      Extractor that returns the display string (or null/undefined)
 *                      from a single translation object.
 * @param fallbackId    The last-resort label (typically the entity's `id`).
 *
 * @returns `{ label: string; isFallback: boolean }` — where `isFallback: true`
 *          signals that a `MissingTranslationBadge` should be rendered.
 */
export function resolveTranslation<T extends { locale: string }>(
  translations: T[],
  activeLocale: string,
  getLabel: (t: T) => string | null | undefined,
  fallbackId: string,
): { label: string; isFallback: boolean } {
  // Tier 1: active locale
  const activeTr = translations.find((t) => t.locale === activeLocale);
  if (activeTr !== undefined) {
    const label = getLabel(activeTr);
    if (label != null && label !== '') {
      return { label, isFallback: false };
    }
  }

  // Tier 2: English fallback (skip if activeLocale is already "en" — already
  // handled above and wasn't usable)
  const enTr = translations.find((t) => t.locale === 'en');
  if (enTr !== undefined) {
    const label = getLabel(enTr);
    if (label != null && label !== '') {
      return { label, isFallback: true };
    }
  }

  // Tier 3: raw identifier fallback
  return { label: fallbackId, isFallback: true };
}
