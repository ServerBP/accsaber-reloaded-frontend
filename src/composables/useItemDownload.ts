import { downloadUserItemFile } from '@/api/items'
import { parseApiError } from '@/api/client'
import type { UserItemResponse } from '@/types/api/items'
import { ref } from 'vue'

const STATUS_MESSAGES: Record<number, string> = {
  400: "This item isn't available to download.",
  404: 'File not found - contact staff.',
  401: 'Your session has expired. Sign in again to download.',
}

function fallbackFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'item'}.saber`
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function useItemDownload() {
  const downloadingLinkId = ref<string | null>(null)

  async function download(userItem: UserItemResponse): Promise<string> {
    downloadingLinkId.value = userItem.linkId
    try {
      const { blob, filename } = await downloadUserItemFile(userItem.linkId)
      const name = filename ?? fallbackFilename(userItem.item.name)
      saveBlob(blob, name)
      return name
    } catch (err) {
      const parsed = parseApiError(err, 'Download failed - try again.')
      throw new Error(STATUS_MESSAGES[parsed.status] ?? parsed.message)
    } finally {
      downloadingLinkId.value = null
    }
  }

  return { downloadingLinkId, download }
}
