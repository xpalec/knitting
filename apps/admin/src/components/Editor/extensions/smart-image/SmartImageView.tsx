import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import {
  SmartImageDetailsDialog,
  SmartImageLightboxDialog,
  SmartImageLinkDialog,
} from './SmartImageSettingsDialogs'
import type {
  SmartImageAlign,
  SmartImageAttributes,
  SmartImageOptions,
} from './SmartImage.types'
import {
  clamp,
  SMART_IMAGE_WIDTH_PRESETS,
  uploadSmartImageFile,
} from './SmartImage.utils'

type DialogName = 'link' | 'lightbox' | 'details' | null
type ResizeDirection = 'left' | 'right'

interface ResizeState {
  startX: number
  startWidth: number
  direction: ResizeDirection
  maxWidth: number
}

function getAlignmentStyle(align: SmartImageAlign) {
  if (align === 'left') {
    return { justifyContent: 'flex-start' }
  }

  if (align === 'right') {
    return { justifyContent: 'flex-end' }
  }

  return { justifyContent: 'center' }
}

export function SmartImageView(props: NodeViewProps) {
  const {
    node,
    selected,
    updateAttributes,
    deleteNode,
    editor,
    extension,
  } = props
  const attrs = node.attrs as SmartImageAttributes
  const options = extension.options as SmartImageOptions
  const frameRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const resizeStateRef = useRef<ResizeState | null>(null)
  const draftWidthRef = useRef<number | null>(attrs.width)

  const [draftWidth, setDraftWidth] = useState<number | null>(attrs.width)
  const [dialog, setDialog] = useState<DialogName>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (!resizeStateRef.current) {
      draftWidthRef.current = attrs.width
      setDraftWidth(attrs.width)
    }
  }, [attrs.width])

  const effectiveWidth = draftWidth ?? null

  const update = useCallback(
    (next: Partial<SmartImageAttributes>) => {
      updateAttributes(next)
    },
    [updateAttributes],
  )

  const beginResize = (
    event: ReactPointerEvent<HTMLButtonElement>,
    direction: ResizeDirection,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const frame = frameRef.current
    if (!frame) {
      return
    }

    const editorWidth = editor.view.dom.getBoundingClientRect().width
    const configuredMaximum = Math.min(options.maxWidth, editorWidth)

    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: frame.getBoundingClientRect().width,
      direction,
      maxWidth: configuredMaximum,
    }

    document.body.classList.add('smart-image-is-resizing')
  }

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const state = resizeStateRef.current
      if (!state) {
        return
      }

      event.preventDefault()
      const delta = event.clientX - state.startX
      const signedDelta = state.direction === 'left' ? -delta : delta
      const width = Math.round(
        clamp(
          state.startWidth + signedDelta,
          options.minWidth,
          state.maxWidth,
        ),
      )

      draftWidthRef.current = width
      setDraftWidth(width)
    }

    const onPointerUp = () => {
      if (!resizeStateRef.current) {
        return
      }

      resizeStateRef.current = null
      document.body.classList.remove('smart-image-is-resizing')
      updateAttributes({ width: draftWidthRef.current })
    }

    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      document.body.classList.remove('smart-image-is-resizing')
    }
  }, [options.minWidth, updateAttributes])

  const replaceImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    const controller = new AbortController()
    setUploadProgress(0)
    setUploadError(null)

    try {
      const result = await uploadSmartImageFile(file, options, {
        signal: controller.signal,
        onProgress: progress => setUploadProgress(progress),
      })

      update({
        src: result.src,
        lightboxSrc:
          result.lightboxSrc ??
          (options.useSrcAsLightboxFallback ? result.src : null),
        assetId: result.assetId ?? null,
        alt: result.alt ?? attrs.alt,
        title: result.title ?? attrs.title,
        naturalWidth: result.naturalWidth ?? null,
        naturalHeight: result.naturalHeight ?? null,
      })
    } catch (error) {
      if (!controller.signal.aborted) {
        setUploadError(
          error instanceof Error ? error.message : 'Image upload failed.',
        )
      }
    } finally {
      setUploadProgress(null)
    }
  }

  const sizeLabel = useMemo(() => {
    if (draftWidth === null) {
      return 'Full width'
    }

    const preset = SMART_IMAGE_WIDTH_PRESETS.find(
      item => item.value === draftWidth,
    )
    return preset?.label ?? `${draftWidth}px`
  }, [draftWidth])

  return (
    <NodeViewWrapper
      className={`smart-image-node ${selected ? 'is-selected' : ''}`}
      data-align={attrs.align}
      style={getAlignmentStyle(attrs.align)}
    >
      <div
        ref={frameRef}
        className="smart-image-frame"
        style={{
          width: effectiveWidth === null ? '100%' : `${effectiveWidth}px`,
          maxWidth: '100%',
        }}
      >
        {selected ? (
          <div
            className="smart-image-toolbar"
            contentEditable={false}
          >
            <button type="button" onClick={() => inputRef.current?.click()}>
              Replace
            </button>

            <span className="smart-image-toolbar__separator" />

            {(['left', 'center', 'right'] as SmartImageAlign[]).map(
              align => (
                <button
                  key={align}
                  type="button"
                  className={attrs.align === align ? 'is-active' : ''}
                  aria-label={`Align ${align}`}
                  onClick={() => update({ align })}
                >
                  {align === 'left' ? '⇤' : align === 'right' ? '⇥' : '↔'}
                </button>
              ),
            )}

            <select
              aria-label="Image size"
              value={draftWidth === null ? 'full' : String(draftWidth)}
              title={sizeLabel}
              onChange={event => {
                const width =
                  event.target.value === 'full'
                    ? null
                    : Number(event.target.value)
                draftWidthRef.current = width
                setDraftWidth(width)
                update({ width })
              }}
            >
              {SMART_IMAGE_WIDTH_PRESETS.map(preset => (
                <option
                  key={preset.label}
                  value={preset.value === null ? 'full' : preset.value}
                >
                  {preset.label}
                  {preset.value === null ? '' : ` — ${preset.value}px`}
                </option>
              ))}
              {draftWidth !== null &&
              !SMART_IMAGE_WIDTH_PRESETS.some(
                preset => preset.value === draftWidth,
              ) ? (
                <option value={draftWidth}>Custom — {draftWidth}px</option>
              ) : null}
            </select>

            <button
              type="button"
              className={attrs.clickAction === 'link' ? 'is-active' : ''}
              onClick={() => setDialog('link')}
            >
              Link
            </button>
            <button
              type="button"
              className={attrs.clickAction === 'lightbox' ? 'is-active' : ''}
              onClick={() => setDialog('lightbox')}
            >
              Lightbox
            </button>
            <button type="button" onClick={() => setDialog('details')}>
              Details
            </button>
            <button
              type="button"
              className="smart-image-toolbar__delete"
              onClick={deleteNode}
            >
              Delete
            </button>
          </div>
        ) : null}

        <img
          className="smart-image-node__image"
          src={attrs.src}
          alt={attrs.alt || ''}
          title={attrs.title ?? undefined}
          draggable={false}
        />

        {uploadProgress !== null ? (
          <div className="smart-image-upload-overlay" contentEditable={false}>
            Uploading… {Math.round(uploadProgress)}%
          </div>
        ) : null}

        {selected ? (
          <>
            <button
              type="button"
              className="smart-image-resize-handle smart-image-resize-handle--left"
              aria-label="Resize image from the left"
              contentEditable={false}
              onPointerDown={event => beginResize(event, 'left')}
            />
            <button
              type="button"
              className="smart-image-resize-handle smart-image-resize-handle--right"
              aria-label="Resize image from the right"
              contentEditable={false}
              onPointerDown={event => beginResize(event, 'right')}
            />
          </>
        ) : null}
      </div>

      <input
        ref={inputRef}
        hidden
        type="file"
        accept={options.allowedMimeTypes.join(',')}
        onChange={replaceImage}
      />

      {uploadError ? (
        <p className="smart-image-node__error" contentEditable={false}>
          {uploadError}
        </p>
      ) : null}

      <SmartImageLinkDialog
        open={dialog === 'link'}
        attrs={attrs}
        onClose={() => setDialog(null)}
        onUpdate={update}
      />
      <SmartImageLightboxDialog
        open={dialog === 'lightbox'}
        attrs={attrs}
        onClose={() => setDialog(null)}
        onUpdate={update}
      />
      <SmartImageDetailsDialog
        open={dialog === 'details'}
        attrs={attrs}
        onClose={() => setDialog(null)}
        onUpdate={update}
      />
    </NodeViewWrapper>
  )
}
