import { mergeAttributes } from '@tiptap/core'
import TiptapImage from '@tiptap/extension-image'
import type { DOMOutputSpec } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { SmartImageView } from './SmartImageView'
import type {
  SmartImageAlign,
  SmartImageAttributes,
  SmartImageClickAction,
  SmartImageInsertAttributes,
  SmartImageOptions,
} from './SmartImage.types'
import {
  getDefaultAttributes,
  isSafeResourceUrl,
  parseNullableNumber,
  SMART_IMAGE_NAME,
  uploadSmartImageFile,
} from './SmartImage.utils'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    smartImage: {
      insertSmartImage: (attributes: SmartImageInsertAttributes) => ReturnType
      updateSmartImage: (
        attributes: Partial<SmartImageAttributes>,
      ) => ReturnType
      setSmartImageAlignment: (align: SmartImageAlign) => ReturnType
      setSmartImageWidth: (width: number | null) => ReturnType
      setSmartImageClickAction: (
        clickAction: SmartImageClickAction,
      ) => ReturnType
    }
  }
}

function getFigureImage(element: HTMLElement): HTMLImageElement | null {
  return element.querySelector('img')
}

function getFigureAttribute(
  element: HTMLElement,
  name: string,
): string | null {
  return element.getAttribute(name)
}

function readFigureAttributes(element: HTMLElement): SmartImageAttributes | false {
  const image = getFigureImage(element)
  const src = image?.getAttribute('src')?.trim()

  if (!image || !src) {
    return false
  }

  const widthFromStyle = image.style.width.endsWith('px')
    ? image.style.width
    : null

  return {
    src,
    alt: image.getAttribute('alt') ?? '',
    title: image.getAttribute('title'),
    width: parseNullableNumber(
      getFigureAttribute(element, 'data-width') ??
        image.getAttribute('width') ??
        widthFromStyle,
    ),
    align:
      (getFigureAttribute(element, 'data-align') as SmartImageAlign | null) ??
      'center',
    href: getFigureAttribute(element, 'data-href'),
    target:
      (getFigureAttribute(element, 'data-target') as '_self' | '_blank') ??
      '_self',
    rel: getFigureAttribute(element, 'data-rel'),
    lightboxSrc: getFigureAttribute(element, 'data-lightbox-src'),
    lightboxGroup: getFigureAttribute(element, 'data-lightbox-group'),
    clickAction:
      (getFigureAttribute(
        element,
        'data-click-action',
      ) as SmartImageClickAction | null) ?? 'none',
    assetId: getFigureAttribute(element, 'data-asset-id'),
    naturalWidth: parseNullableNumber(image.getAttribute('data-natural-width')),
    naturalHeight: parseNullableNumber(image.getAttribute('data-natural-height')),
  }
}

function attrsToContent(
  options: SmartImageOptions,
  result: Awaited<ReturnType<typeof uploadSmartImageFile>>,
): SmartImageInsertAttributes {
  const lightboxSrc = result.lightboxSrc ??
    (options.useSrcAsLightboxFallback ? result.src : null)

  return {
    src: result.src,
    alt: result.alt ?? '',
    title: result.title ?? null,
    width: options.defaultWidth,
    align: options.defaultAlign,
    lightboxSrc,
    clickAction:
      lightboxSrc && options.defaultClickAction === 'lightbox'
        ? 'lightbox'
        : options.defaultClickAction,
    assetId: result.assetId ?? null,
    naturalWidth: result.naturalWidth ?? null,
    naturalHeight: result.naturalHeight ?? null,
  }
}

export const SmartImage = TiptapImage.extend<SmartImageOptions>({
  name: SMART_IMAGE_NAME,
  group: 'block',
  inline: false,
  atom: true,
  defining: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return {
      ...this.parent?.(),
      HTMLAttributes: {},
      upload: undefined,
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
      ],
      maxFileSize: 10 * 1024 * 1024,
      minWidth: 160,
      maxWidth: 860,
      defaultWidth: null,
      defaultAlign: 'center',
      defaultClickAction: 'none',
      enablePasteUpload: true,
      enableDropUpload: true,
      useSrcAsLightboxFallback: true,
      onError: undefined,
    }
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: '',
      },
      title: {
        default: null,
      },
      width: {
        default: this.options.defaultWidth,
      },
      align: {
        default: this.options.defaultAlign,
      },
      href: {
        default: null,
      },
      target: {
        default: '_self',
      },
      rel: {
        default: null,
      },
      lightboxSrc: {
        default: null,
      },
      lightboxGroup: {
        default: null,
      },
      clickAction: {
        default: this.options.defaultClickAction,
      },
      assetId: {
        default: null,
      },
      naturalWidth: {
        default: null,
      },
      naturalHeight: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-type="smart-image"]',
        getAttrs: element => readFigureAttributes(element as HTMLElement),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as SmartImageAttributes
    const widthStyle = attrs.width ? `${attrs.width}px` : '100%'

    const imageAttributes = mergeAttributes(this.options.HTMLAttributes, {
      src: attrs.src,
      alt: attrs.alt || '',
      title: attrs.title,
      width: attrs.width,
      'data-natural-width': attrs.naturalWidth,
      'data-natural-height': attrs.naturalHeight,
      style: `display:block;width:100%;max-width:100%;height:auto;`,
    })

    const image: DOMOutputSpec = ['img', imageAttributes]
    const wrapperStyle = `display:block;width:${widthStyle};max-width:100%;`
    let interactiveImage: DOMOutputSpec = [
      'span',
      { style: wrapperStyle },
      image,
    ]

    if (attrs.clickAction === 'link' && attrs.href) {
      interactiveImage = [
        'a',
        {
          href: attrs.href,
          target: attrs.target,
          rel:
            attrs.target === '_blank'
              ? attrs.rel || 'noopener noreferrer'
              : attrs.rel,
          style: wrapperStyle,
        },
        image,
      ]
    }

    if (attrs.clickAction === 'lightbox') {
      const lightboxHref = attrs.lightboxSrc || attrs.src
      interactiveImage = [
        'a',
        {
          href: lightboxHref,
          'data-smart-image-lightbox': 'true',
          'data-lightbox-group': attrs.lightboxGroup,
          'aria-label': attrs.alt
            ? `Open larger image: ${attrs.alt}`
            : 'Open larger image',
          style: wrapperStyle,
        },
        image,
      ]
    }

    const justifyContent =
      attrs.align === 'left'
        ? 'flex-start'
        : attrs.align === 'right'
          ? 'flex-end'
          : 'center'

    return [
      'figure',
      {
        'data-type': 'smart-image',
        'data-width': attrs.width,
        'data-align': attrs.align,
        'data-href': attrs.href,
        'data-target': attrs.target,
        'data-rel': attrs.rel,
        'data-lightbox-src': attrs.lightboxSrc,
        'data-lightbox-group': attrs.lightboxGroup,
        'data-click-action': attrs.clickAction,
        'data-asset-id': attrs.assetId,
        class: `smart-image-output smart-image-output--${attrs.align}`,
        style: `display:flex;width:100%;justify-content:${justifyContent};`,
      },
      interactiveImage,
    ]
  },

  addCommands() {
    return {
      insertSmartImage:
        attributes =>
        ({ commands }) => {
          if (!isSafeResourceUrl(attributes.src)) {
            this.options.onError?.({
              type: 'invalid-url',
              message: 'The image URL is invalid or unsafe.',
            })
            return false
          }

          return commands.insertContent({
            type: this.name,
            attrs: {
              ...getDefaultAttributes(this.options),
              ...attributes,
            },
          })
        },
      updateSmartImage:
        attributes =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attributes),
      setSmartImageAlignment:
        align =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { align }),
      setSmartImageWidth:
        width =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { width }),
      setSmartImageClickAction:
        clickAction =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { clickAction }),
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(SmartImageView)
  },

  addProseMirrorPlugins() {
    const options = this.options
    const editor = this.editor

    const uploadFilesAt = async (files: File[], position: number) => {
      const controller = new AbortController()

      try {
        const uploaded = []
        for (const file of files) {
          const result = await uploadSmartImageFile(file, options, {
            signal: controller.signal,
            onProgress: () => undefined,
          })
          uploaded.push({
            type: this.name,
            attrs: {
              ...getDefaultAttributes(options),
              ...attrsToContent(options, result),
            },
          })
        }

        editor
          .chain()
          .focus()
          .insertContentAt(position, uploaded)
          .run()
      } catch {
        // Errors are reported through options.onError and the UI upload flow.
      }
    }

    return [
      new Plugin({
        key: new PluginKey('smartImagePasteDrop'),
        props: {
          handlePaste: (view, event) => {
            if (!options.enablePasteUpload || !options.upload) {
              return false
            }

            const files = Array.from(event.clipboardData?.files ?? []).filter(
              file => file.type.startsWith('image/'),
            )

            if (!files.length) {
              return false
            }

            event.preventDefault()
            void uploadFilesAt(files, view.state.selection.from)
            return true
          },
          handleDrop: (view, event, _slice, moved) => {
            if (moved || !options.enableDropUpload || !options.upload) {
              return false
            }

            const files = Array.from(event.dataTransfer?.files ?? []).filter(
              file => file.type.startsWith('image/'),
            )

            if (!files.length) {
              return false
            }

            const coordinates = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            })

            if (!coordinates) {
              return false
            }

            event.preventDefault()
            void uploadFilesAt(files, coordinates.pos)
            return true
          },
        },
      }),
    ]
  },
})
