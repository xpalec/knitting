import { useEffect, useState } from 'react'

import { SmartImageDialog } from './SmartImageDialog'
import type {
  SmartImageAttributes,
  SmartImageClickAction,
  SmartImageTarget,
} from './SmartImage.types'
import { isSafeLinkUrl, isSafeResourceUrl } from './SmartImage.utils'

interface CommonProps {
  open: boolean
  attrs: SmartImageAttributes
  onClose: () => void
  onUpdate: (attrs: Partial<SmartImageAttributes>) => void
}

export function SmartImageLinkDialog({
  open,
  attrs,
  onClose,
  onUpdate,
}: CommonProps) {
  const [href, setHref] = useState(attrs.href ?? '')
  const [target, setTarget] = useState<SmartImageTarget>(attrs.target)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setHref(attrs.href ?? '')
      setTarget(attrs.target)
      setError(null)
    }
  }, [open, attrs.href, attrs.target])

  const save = () => {
    const trimmed = href.trim()

    if (trimmed && !isSafeLinkUrl(trimmed)) {
      setError('Enter a valid http(s), relative, mailto, tel, or anchor URL.')
      return
    }

    onUpdate({
      href: trimmed || null,
      target,
      rel: target === '_blank' ? 'noopener noreferrer' : null,
      clickAction: trimmed ? 'link' : attrs.clickAction === 'link' ? 'none' : attrs.clickAction,
    })
    onClose()
  }

  return (
    <SmartImageDialog
      open={open}
      title="Image link"
      onClose={onClose}
      onSubmit={save}
      destructiveLabel={attrs.href ? 'Remove link' : undefined}
      onDestructive={
        attrs.href
          ? () => {
              onUpdate({
                href: null,
                target: '_self',
                rel: null,
                clickAction:
                  attrs.clickAction === 'link' ? 'none' : attrs.clickAction,
              })
              onClose()
            }
          : undefined
      }
    >
      <label className="smart-image-field">
        <span>Link URL</span>
        <input
          autoFocus
          value={href}
          placeholder="https://example.com or /entry/example"
          onChange={event => setHref(event.target.value)}
        />
      </label>

      <fieldset className="smart-image-fieldset">
        <legend>Open in</legend>
        <label>
          <input
            type="radio"
            checked={target === '_self'}
            onChange={() => setTarget('_self')}
          />
          Same tab
        </label>
        <label>
          <input
            type="radio"
            checked={target === '_blank'}
            onChange={() => setTarget('_blank')}
          />
          New tab
        </label>
      </fieldset>

      {error ? <p className="smart-image-error">{error}</p> : null}
    </SmartImageDialog>
  )
}

export function SmartImageLightboxDialog({
  open,
  attrs,
  onClose,
  onUpdate,
}: CommonProps) {
  const [lightboxSrc, setLightboxSrc] = useState(attrs.lightboxSrc ?? '')
  const [lightboxGroup, setLightboxGroup] = useState(
    attrs.lightboxGroup ?? '',
  )
  const [useDisplayedImage, setUseDisplayedImage] = useState(
    !attrs.lightboxSrc,
  )
  const [clickAction, setClickAction] = useState<SmartImageClickAction>(
    attrs.clickAction,
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setLightboxSrc(attrs.lightboxSrc ?? '')
      setLightboxGroup(attrs.lightboxGroup ?? '')
      setUseDisplayedImage(!attrs.lightboxSrc)
      setClickAction(attrs.clickAction)
      setError(null)
    }
  }, [
    open,
    attrs.lightboxSrc,
    attrs.lightboxGroup,
    attrs.clickAction,
  ])

  const save = () => {
    const trimmed = lightboxSrc.trim()

    if (!useDisplayedImage && !isSafeResourceUrl(trimmed)) {
      setError('Enter a valid http(s) or relative image URL.')
      return
    }

    if (clickAction === 'link' && !attrs.href) {
      setError('Add an image link before selecting “Open link”.')
      return
    }

    onUpdate({
      lightboxSrc: useDisplayedImage ? null : trimmed,
      lightboxGroup: lightboxGroup.trim() || null,
      clickAction,
    })
    onClose()
  }

  return (
    <SmartImageDialog
      open={open}
      title="Lightbox"
      onClose={onClose}
      onSubmit={save}
      destructiveLabel={
        attrs.lightboxSrc || attrs.clickAction === 'lightbox'
          ? 'Remove lightbox'
          : undefined
      }
      onDestructive={
        attrs.lightboxSrc || attrs.clickAction === 'lightbox'
          ? () => {
              onUpdate({
                lightboxSrc: null,
                lightboxGroup: null,
                clickAction:
                  attrs.clickAction === 'lightbox' ? 'none' : attrs.clickAction,
              })
              onClose()
            }
          : undefined
      }
    >
      <label className="smart-image-field">
        <span>Large/original image URL</span>
        <input
          value={lightboxSrc}
          disabled={useDisplayedImage}
          placeholder="https://cdn.example.com/image-original.webp"
          onChange={event => setLightboxSrc(event.target.value)}
        />
      </label>

      <label className="smart-image-checkbox">
        <input
          type="checkbox"
          checked={useDisplayedImage}
          onChange={event => setUseDisplayedImage(event.target.checked)}
        />
        Use the displayed image when no separate original is needed
      </label>

      <label className="smart-image-field">
        <span>Gallery group (optional)</span>
        <input
          value={lightboxGroup}
          placeholder="entry-gallery"
          onChange={event => setLightboxGroup(event.target.value)}
        />
      </label>

      <fieldset className="smart-image-fieldset">
        <legend>Image click behavior</legend>
        {(
          [
            ['none', 'No action'],
            ['link', 'Open link'],
            ['lightbox', 'Open lightbox'],
          ] as Array<[SmartImageClickAction, string]>
        ).map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              checked={clickAction === value}
              onChange={() => setClickAction(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      {error ? <p className="smart-image-error">{error}</p> : null}
    </SmartImageDialog>
  )
}

export function SmartImageDetailsDialog({
  open,
  attrs,
  onClose,
  onUpdate,
}: CommonProps) {
  const [src, setSrc] = useState(attrs.src)
  const [alt, setAlt] = useState(attrs.alt)
  const [title, setTitle] = useState(attrs.title ?? '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSrc(attrs.src)
      setAlt(attrs.alt)
      setTitle(attrs.title ?? '')
      setError(null)
    }
  }, [open, attrs.src, attrs.alt, attrs.title])

  const save = () => {
    const trimmedSrc = src.trim()

    if (!isSafeResourceUrl(trimmedSrc)) {
      setError('Enter a valid http(s) or relative image URL.')
      return
    }

    onUpdate({
      src: trimmedSrc,
      alt: alt.trim(),
      title: title.trim() || null,
    })
    onClose()
  }

  return (
    <SmartImageDialog
      open={open}
      title="Image details"
      onClose={onClose}
      onSubmit={save}
    >
      <label className="smart-image-field">
        <span>Displayed image URL</span>
        <input value={src} onChange={event => setSrc(event.target.value)} />
      </label>

      <label className="smart-image-field">
        <span>Alternative text</span>
        <textarea
          value={alt}
          rows={3}
          placeholder="Describe the image for accessibility and search"
          onChange={event => setAlt(event.target.value)}
        />
      </label>

      <label className="smart-image-field">
        <span>Title (optional)</span>
        <input
          value={title}
          onChange={event => setTitle(event.target.value)}
        />
      </label>

      {attrs.assetId ? (
        <div className="smart-image-readonly-value">
          <span>Asset ID</span>
          <code>{attrs.assetId}</code>
        </div>
      ) : null}

      {error ? <p className="smart-image-error">{error}</p> : null}
    </SmartImageDialog>
  )
}
