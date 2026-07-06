import type { ChangeEvent } from 'react'
import { useMemo, useState } from 'react'

import { SmartImageDialog } from './SmartImageDialog'
import type {
  SmartImageInsertButtonProps,
  SmartImageInsertAttributes,
} from './SmartImage.types'
import {
  getSmartImageOptionsFromEditor,
  isSafeResourceUrl,
  uploadSmartImageFile,
} from './SmartImage.utils'

type InsertMode = 'upload' | 'url'

export function SmartImageInsertButton({
  editor,
  className,
  label = 'Image',
}: SmartImageInsertButtonProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<InsertMode>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [src, setSrc] = useState('')
  const [alt, setAlt] = useState('')
  const [lightboxSrc, setLightboxSrc] = useState('')
  const [enableLightbox, setEnableLightbox] = useState(true)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const options = useMemo(() => {
    if (!editor) {
      return null
    }

    try {
      return getSmartImageOptionsFromEditor(editor)
    } catch {
      return null
    }
  }, [editor])

  const reset = () => {
    setMode(options?.upload ? 'upload' : 'url')
    setFile(null)
    setSrc('')
    setAlt('')
    setLightboxSrc('')
    setEnableLightbox(true)
    setProgress(null)
    setError(null)
  }

  const close = () => {
    setOpen(false)
    reset()
  }

  const insert = (attrs: SmartImageInsertAttributes) => {
    if (!editor) {
      return
    }

    editor.chain().focus().insertSmartImage(attrs).run()
    close()
  }

  const submit = async () => {
    if (!editor || !options) {
      return
    }

    setError(null)

    if (mode === 'url') {
      const imageUrl = src.trim()
      const originalUrl = lightboxSrc.trim()

      if (!isSafeResourceUrl(imageUrl)) {
        setError('Enter a valid http(s) or relative image URL.')
        return
      }

      if (originalUrl && !isSafeResourceUrl(originalUrl)) {
        setError('The lightbox URL is invalid.')
        return
      }

      insert({
        src: imageUrl,
        alt: alt.trim(),
        lightboxSrc: enableLightbox ? originalUrl || null : null,
        clickAction: enableLightbox ? 'lightbox' : 'none',
      })
      return
    }

    if (!file) {
      setError('Choose an image file.')
      return
    }

    const controller = new AbortController()
    setProgress(0)

    try {
      const result = await uploadSmartImageFile(file, options, {
        signal: controller.signal,
        onProgress: value => setProgress(value),
      })

      const resolvedLightboxSrc = enableLightbox
        ? result.lightboxSrc ??
          (options.useSrcAsLightboxFallback ? result.src : null)
        : null

      insert({
        src: result.src,
        alt: alt.trim() || result.alt || '',
        title: result.title ?? null,
        lightboxSrc: resolvedLightboxSrc,
        clickAction: resolvedLightboxSrc ? 'lightbox' : 'none',
        assetId: result.assetId ?? null,
        naturalWidth: result.naturalWidth ?? null,
        naturalHeight: result.naturalHeight ?? null,
      })
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Image upload failed.',
      )
    } finally {
      setProgress(null)
    }
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null)
    setError(null)
  }

  return (
    <>
      <button
        type="button"
        className={className ?? 'smart-image-button'}
        disabled={!editor || !options}
        onClick={() => {
          reset()
          setOpen(true)
        }}
      >
        {label}
      </button>

      <SmartImageDialog
        open={open}
        title="Insert image"
        submitLabel={progress === null ? 'Insert image' : 'Uploading…'}
        onClose={close}
        onSubmit={progress === null ? submit : undefined}
      >
        <div className="smart-image-tabs" role="tablist">
          {options?.upload ? (
            <button
              type="button"
              role="tab"
              className={mode === 'upload' ? 'is-active' : ''}
              onClick={() => setMode('upload')}
            >
              Upload
            </button>
          ) : null}
          <button
            type="button"
            role="tab"
            className={mode === 'url' ? 'is-active' : ''}
            onClick={() => setMode('url')}
          >
            Image URL
          </button>
        </div>

        {mode === 'upload' && options?.upload ? (
          <label className="smart-image-upload-field">
            <span>{file ? file.name : 'Choose an image or drop it here'}</span>
            <input
              type="file"
              accept={options.allowedMimeTypes.join(',')}
              onChange={onFileChange}
            />
          </label>
        ) : (
          <label className="smart-image-field">
            <span>Displayed image URL</span>
            <input
              autoFocus
              value={src}
              placeholder="https://cdn.example.com/image.webp"
              onChange={event => setSrc(event.target.value)}
            />
          </label>
        )}

        <label className="smart-image-field">
          <span>Alternative text</span>
          <textarea
            rows={3}
            value={alt}
            placeholder="Describe the image"
            onChange={event => setAlt(event.target.value)}
          />
        </label>

        <label className="smart-image-checkbox">
          <input
            type="checkbox"
            checked={enableLightbox}
            onChange={event => setEnableLightbox(event.target.checked)}
          />
          Open a lightbox when the image is clicked
        </label>

        {mode === 'url' && enableLightbox ? (
          <label className="smart-image-field">
            <span>Large/original image URL (optional)</span>
            <input
              value={lightboxSrc}
              placeholder="Leave empty to use the displayed image"
              onChange={event => setLightboxSrc(event.target.value)}
            />
          </label>
        ) : null}

        {progress !== null ? (
          <div className="smart-image-progress">
            <div style={{ width: `${Math.max(2, progress)}%` }} />
            <span>{Math.round(progress)}%</span>
          </div>
        ) : null}

        {error ? <p className="smart-image-error">{error}</p> : null}
      </SmartImageDialog>
    </>
  )
}
