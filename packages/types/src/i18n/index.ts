/**
 * i18n module — locale constants, path segments, and the `localePath` helper.
 *
 * Import from here in app code:
 *   import { localePath, SUPPORTED_LOCALES, type Locale } from "@knitting/types/i18n"
 * or from the package root:
 *   import { localePath, SUPPORTED_LOCALES, type Locale } from "@knitting/types"
 */

export { localePath } from "./localePath.js";
export {
  DEFAULT_LOCALE,
  PAGE_KEYS,
  PATH_SEGMENTS,
  SEGMENT_TO_CANONICAL,
  SUPPORTED_LOCALES,
} from "./segments.js";
export type { Locale, PageKey } from "./segments.js";
