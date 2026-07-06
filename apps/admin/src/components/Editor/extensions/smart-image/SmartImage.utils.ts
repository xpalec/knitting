import type {
  SmartImageAttributes,
  SmartImageError,
  SmartImageOptions,
  SmartImageUploadContext,
  UploadedSmartImage,
} from './SmartImage.types'

export const SMART_IMAGE_NAME = 'smartImage'

export const SMART_IMAGE_WIDTH_PRESETS = [
  { label: 'Small', value: 320 },
  { label: 'Medium', value: 480 },
  { label: 'Large', value: 640 },
  { label: 'Extra large', value: 800 },
  { label: 'Full width', value: null },
] as const

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function getDefaultAttributes(
  options: SmartImageOptions,
): Omit<SmartImageAttributes, 'src'> {
  return {
    alt: '',
    title: null,
    width: options.defaultWidth,
    align: options.defaultAlign,
    href: null,
    target: '_self',
    rel: null,
    lightboxSrc: null,
    lightboxGroup: null,
    clickAction: options.defaultClickAction,
    assetId: null,
    naturalWidth: null,
    naturalHeight: null,
  }
}

export function validateImageFile(
  file: File,
  options: SmartImageOptions,
): SmartImageError | null {
  if (!options.allowedMimeTypes.includes(file.type)) {
    return {
      type: 'file-type',
      message: `Unsupported image type: ${file.type || 'unknown'}`,
      file,
    }
  }

  if (file.size > options.maxFileSize) {
    const maxMb = Math.round((options.maxFileSize / 1024 / 1024) * 10) / 10
    return {
      type: 'file-size',
      message: `The image is too large. Maximum size is ${maxMb} MB.`,
      file,
    }
  }

  return null
}

export function isSafeResourceUrl(value: string): boolean {
  const url = value.trim()

  if (!url) {
    return false
  }

  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
    return true
  }

  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function isSafeLinkUrl(value: string): boolean {
  const url = value.trim()

  if (!url) {
    return false
  }

  if (
    url.startsWith('/') ||
    url.startsWith('#') ||
    url.startsWith('./') ||
    url.startsWith('../')
  ) {
    return true
  }

  try {
    const parsed = new URL(url)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

export async function uploadSmartImageFile(
  file: File,
  options: SmartImageOptions,
  context: SmartImageUploadContext,
): Promise<UploadedSmartImage> {
  const validationError = validateImageFile(file, options)

  if (validationError) {
    options.onError?.(validationError)
    throw new Error(validationError.message)
  }

  if (!options.upload) {
    const error: SmartImageError = {
      type: 'upload',
      message: 'SmartImage upload is not configured.',
      file,
    }
    options.onError?.(error)
    throw new Error(error.message)
  }

  try {
    const result = await options.upload(file, context)

    if (!isSafeResourceUrl(result.src)) {
      throw new Error('The upload returned an invalid image URL.')
    }

    return result
  } catch (cause) {
    if (context.signal.aborted) {
      throw cause
    }

    const error: SmartImageError = {
      type: 'upload',
      message: cause instanceof Error ? cause.message : 'Image upload failed.',
      file,
      cause,
    }
    options.onError?.(error)
    throw cause
  }
}

export function getSmartImageOptionsFromEditor(editor: {
  extensionManager: { extensions: Array<{ name: string; options: unknown }> }
}): SmartImageOptions {
  const extension = editor.extensionManager.extensions.find(
    item => item.name === SMART_IMAGE_NAME,
  )

  if (!extension) {
    throw new Error(
      'SmartImage extension is not registered in this Tiptap editor.',
    )
  }

  return extension.options as SmartImageOptions
}
