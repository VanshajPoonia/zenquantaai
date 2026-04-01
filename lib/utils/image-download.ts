import { Attachment } from '@/types'

function getExtensionFromMimeType(mimeType: string | undefined): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    case 'image/svg+xml':
      return 'svg'
    default:
      return 'png'
  }
}

function normalizeDownloadName(attachment: Attachment): string {
  const trimmed = attachment.name.trim()
  if (trimmed) return trimmed
  return `zenquanta-image.${getExtensionFromMimeType(attachment.mimeType)}`
}

function triggerBrowserDownload(url: string, fileName: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

export function openAttachmentImageInNewTab(attachment: Attachment) {
  if (!attachment.previewUrl) return
  window.open(attachment.previewUrl, '_blank', 'noopener,noreferrer')
}

export async function downloadAttachmentImage(attachment: Attachment): Promise<void> {
  if (!attachment.previewUrl) return

  let objectUrl: string | null = null

  try {
    const response = await fetch(attachment.previewUrl, {
      cache: 'no-store',
      credentials: 'omit',
    })

    if (!response.ok) {
      throw new Error('Unable to fetch image for download.')
    }

    const blob = await response.blob()
    objectUrl = URL.createObjectURL(blob)
    triggerBrowserDownload(objectUrl, normalizeDownloadName(attachment))
  } catch {
    openAttachmentImageInNewTab(attachment)
  } finally {
    if (objectUrl) {
      setTimeout(() => URL.revokeObjectURL(objectUrl!), 1000)
    }
  }
}
