import { parseApiError } from '@/api/client'
import type { ItemResponse, ItemTypeKey } from '@/types/api/items'
import { rasterize } from '@/utils/rasterize'
import { ref } from 'vue'

export interface CaptureBox {
  width: number
  height: number
}

const TEXT_DRIVEN_TYPES = new Set<ItemTypeKey>(['title', 'perk'])

export function captureBox(typeKey: ItemTypeKey): CaptureBox {
  const side = TEXT_DRIVEN_TYPES.has(typeKey) ? 128 : 256
  return { width: side, height: side }
}

export function iconFileName(item: ItemResponse): string {
  const slug = item.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'item'}.png`
}

export interface IconExportOptions {
  size: number
}

export interface IconExportFailure {
  id: string
  name: string
  message: string
}

export type RenderItem = (item: ItemResponse) => Promise<Element>

const UPLOAD_CONCURRENCY = 3

export function useItemIconExport(renderItem: RenderItem) {
  const running = ref(false)
  const total = ref(0)
  const completed = ref(0)
  const currentName = ref<string | null>(null)
  const failures = ref<IconExportFailure[]>([])
  const warnings = ref<string[]>([])
  const uploaded = ref<ItemResponse[]>([])

  let abort = false

  function cancel() {
    abort = true
  }

  function reset() {
    total.value = 0
    completed.value = 0
    currentName.value = null
    failures.value = []
    warnings.value = []
    uploaded.value = []
  }

  async function uploadOne(item: ItemResponse, blob: Blob) {
    const { uploadItemIcon } = await import('@/api/admin/items')
    const file = new File([blob], iconFileName(item), { type: 'image/png' })
    const updated = await uploadItemIcon(item.id, file)
    uploaded.value.push(updated)
  }

  async function run(items: ItemResponse[], options: IconExportOptions) {
    if (running.value) return
    abort = false
    reset()
    running.value = true
    total.value = items.length

    const pending = new Set<Promise<void>>()

    const track = (task: Promise<void>) => {
      const wrapped = task.finally(() => pending.delete(wrapped))
      pending.add(wrapped)
      return wrapped
    }

    try {
      for (const item of items) {
        if (abort) break
        currentName.value = item.name

        while (pending.size >= UPLOAD_CONCURRENCY) await Promise.race(pending)

        try {
          const host = await renderItem(item)
          const box = captureBox(item.typeKey)
          const result = await rasterize(host, {
            ...box,
            scale: options.size / box.width,
          })
          for (const warning of result.warnings) {
            if (!warnings.value.includes(warning)) warnings.value.push(warning)
          }
          track(
            uploadOne(item, result.blob)
              .catch((err) => {
                failures.value.push({
                  id: item.id,
                  name: item.name,
                  message: parseApiError(err, 'Upload failed').message,
                })
              })
              .finally(() => {
                completed.value += 1
              }),
          )
        } catch (err) {
          completed.value += 1
          failures.value.push({
            id: item.id,
            name: item.name,
            message: err instanceof Error ? err.message : 'Render failed',
          })
        }
      }

      await Promise.all(pending)
    } finally {
      running.value = false
      currentName.value = null
    }
  }

  return { running, total, completed, currentName, failures, warnings, uploaded, run, cancel }
}
