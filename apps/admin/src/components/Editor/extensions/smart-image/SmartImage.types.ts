import type { Editor } from '@tiptap/core'

export type SmartImageAlign = 'left' | 'center' | 'right'
export type SmartImageClickAction = 'none' | 'link' | 'lightbox'
export type SmartImageTarget = '_self' | '_blank'

export interface SmartImageAttributes {
  src: string
  alt: string
  title: string | null
  width: number | null
  align: SmartImageAlign
  href: string | null
  target: SmartImageTarget
  rel: string | null
  lightboxSrc: string | null
  lightboxGroup: string | null
  clickAction: SmartImageClickAction
  assetId: string | null
  naturalWidth: number | null
  naturalHeight: number | null
}

export type SmartImageInsertAttributes = Partial<SmartImageAttributes> &
  Pick<SmartImageAttributes, 'src'>

export interface UploadedSmartImage {
  src: string
  lightboxSrc?: string | null
  assetId?: string | null
  alt?: string
  title?: string | null
  naturalWidth?: number | null
  naturalHeight?: number | null
}

export interface SmartImageUploadContext {
  signal: AbortSignal
  onProgress: (progress: number) => void
}

export interface SmartImageError {
  type: 'file-type' | 'file-size' | 'upload' | 'invalid-url'
  message: string
  file?: File
  cause?: unknown
}

export interface SmartImageOptions {
  HTMLAttributes: Record<string, unknown>
  upload?: (
    file: File,
    context: SmartImageUploadContext,
  ) => Promise<UploadedSmartImage>
  allowedMimeTypes: string[]
  maxFileSize: number
  minWidth: number
  maxWidth: number
  defaultWidth: number | null
  defaultAlign: SmartImageAlign
  defaultClickAction: SmartImageClickAction
  enablePasteUpload: boolean
  enableDropUpload: boolean
  useSrcAsLightboxFallback: boolean
  onError?: (error: SmartImageError) => void
}

export interface SmartImageDialogCommonProps {
  open: boolean
  onClose: () => void
}

export interface SmartImageInsertButtonProps {
  editor: Editor | null
  className?: string
  label?: string
}
