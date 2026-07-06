type ImageAlign = 'left' | 'center' | 'right'
type ImageClickAction = 'none' | 'link' | 'lightbox'

interface CustomImageAttributes {
  src: string
  alt: string
  title: string | null

  width: number | null
  align: ImageAlign

  href: string | null
  target: '_self' | '_blank'
  rel: string | null

  lightboxSrc: string | null
  lightboxGroup: string | null

  clickAction: ImageClickAction

  assetId: string | null
}