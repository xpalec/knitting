import type {
  SmartImageUploadContext,
  UploadedSmartImage,
} from '../src/smart-image'

interface UploadResponse {
  id: string
  displayUrl: string
  originalUrl?: string
  width?: number
  height?: number
  alt?: string
}

/**
 * Example endpoint contract:
 * POST /api/images with multipart field "file"
 *
 * Response:
 * {
 *   "id": "img_123",
 *   "displayUrl": "https://cdn.example.com/img_123-1200.webp",
 *   "originalUrl": "https://cdn.example.com/img_123-original.webp",
 *   "width": 2400,
 *   "height": 1600
 * }
 */
export function uploadImage(
  file: File,
  context: SmartImageUploadContext,
): Promise<UploadedSmartImage> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)

    const abort = () => xhr.abort()
    context.signal.addEventListener('abort', abort, { once: true })

    xhr.open('POST', '/api/images')
    xhr.responseType = 'json'

    xhr.upload.addEventListener('progress', event => {
      if (event.lengthComputable) {
        context.onProgress((event.loaded / event.total) * 100)
      }
    })

    xhr.addEventListener('load', () => {
      context.signal.removeEventListener('abort', abort)

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload failed with status ${xhr.status}.`))
        return
      }

      const response = xhr.response as UploadResponse
      resolve({
        assetId: response.id,
        src: response.displayUrl,
        lightboxSrc: response.originalUrl ?? response.displayUrl,
        alt: response.alt ?? '',
        naturalWidth: response.width ?? null,
        naturalHeight: response.height ?? null,
      })
    })

    xhr.addEventListener('error', () => {
      context.signal.removeEventListener('abort', abort)
      reject(new Error('Network error while uploading the image.'))
    })

    xhr.addEventListener('abort', () => {
      context.signal.removeEventListener('abort', abort)
      reject(new DOMException('Upload was cancelled.', 'AbortError'))
    })

    xhr.send(formData)
  })
}
