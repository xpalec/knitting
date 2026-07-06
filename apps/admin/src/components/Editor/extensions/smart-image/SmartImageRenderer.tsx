import type { CSSProperties, MouseEvent, ReactNode } from 'react'

import type { SmartImageAttributes } from './SmartImage.types'

export interface SmartImageLightboxPayload {
  src: string
  group: string | null
  alt: string
  title: string | null
}

interface SmartImageRendererProps {
  attrs: SmartImageAttributes
  className?: string
  onOpenLightbox?: (payload: SmartImageLightboxPayload) => void
}

function alignmentStyle(align: SmartImageAttributes['align']): CSSProperties {
  if (align === 'left') {
    return { marginLeft: 0, marginRight: 'auto' }
  }

  if (align === 'right') {
    return { marginLeft: 'auto', marginRight: 0 }
  }

  return { marginLeft: 'auto', marginRight: 'auto' }
}

export function SmartImageRenderer({
  attrs,
  className,
  onOpenLightbox,
}: SmartImageRendererProps) {
  const width = attrs.width === null ? '100%' : `${attrs.width}px`

  const image = (
    <img
      src={attrs.src}
      alt={attrs.alt}
      title={attrs.title ?? undefined}
      width={attrs.naturalWidth ?? undefined}
      height={attrs.naturalHeight ?? undefined}
      style={{ display: 'block', width, maxWidth: '100%', height: 'auto' }}
    />
  )

  let content: ReactNode = image

  if (attrs.clickAction === 'link' && attrs.href) {
    content = (
      <a
        href={attrs.href}
        target={attrs.target}
        rel={
          attrs.target === '_blank'
            ? attrs.rel || 'noopener noreferrer'
            : attrs.rel ?? undefined
        }
      >
        {image}
      </a>
    )
  }

  if (attrs.clickAction === 'lightbox') {
    const open = (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      onOpenLightbox?.({
        src: attrs.lightboxSrc || attrs.src,
        group: attrs.lightboxGroup,
        alt: attrs.alt,
        title: attrs.title,
      })
    }

    content = onOpenLightbox ? (
      <button
        type="button"
        className="smart-image-renderer__lightbox-button"
        aria-label={
          attrs.alt ? `Open larger image: ${attrs.alt}` : 'Open larger image'
        }
        onClick={open}
      >
        {image}
      </button>
    ) : (
      <a
        href={attrs.lightboxSrc || attrs.src}
        data-smart-image-lightbox="true"
        data-lightbox-group={attrs.lightboxGroup ?? undefined}
      >
        {image}
      </a>
    )
  }

  return (
    <figure
      className={className ?? 'smart-image-renderer'}
      style={{
        width,
        maxWidth: '100%',
        ...alignmentStyle(attrs.align),
      }}
      data-lightbox-group={attrs.lightboxGroup ?? undefined}
    >
      {content}
    </figure>
  )
}
