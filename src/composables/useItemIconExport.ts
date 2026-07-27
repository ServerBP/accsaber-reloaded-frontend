import { parseApiError } from '@/api/client'
import { uploadItemIcon } from '@/api/admin/items'
import type { ItemResponse, ItemTypeKey } from '@/types/api/items'
import { rasterize, type Rect } from '@/utils/rasterize'
import { ref } from 'vue'

const TEXT_DRIVEN_TYPES = new Set<ItemTypeKey>(['title', 'perk'])
const UPLOAD_CONCURRENCY = 3
const TRIM_PADDING_PCT = 0.08

const FLAT_TEXT_NOTE =
  'Some gradient titles were exported in a flat colour - this browser dropped the gradient clip on their letters.'

function isTextDriven(typeKey: ItemTypeKey): boolean {
  return TEXT_DRIVEN_TYPES.has(typeKey)
}

export function captureBox(typeKey: ItemTypeKey): { width: number; height: number } {
  return isTextDriven(typeKey) ? { width: 512, height: 256 } : { width: 256, height: 256 }
}

function iconFileName(item: ItemResponse): string {
  const slug = item.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'item'}.png`
}

function textRegion(host: Element): Rect | null {
  const span = host.querySelector('.title-renderer__text')
  if (!span) return null
  const hostRect = host.getBoundingClientRect()
  const rect = span.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  return {
    x: rect.left - hostRect.left,
    y: rect.top - hostRect.top,
    w: rect.width,
    h: rect.height,
  }
}

interface IconExportFailure {
  id: string
  name: string
  message: string
}

type RenderItem = (item: ItemResponse, flattenText: boolean) => Promise<Element>

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

  function addWarning(message: string) {
    if (!warnings.value.includes(message)) warnings.value.push(message)
  }

  function addFailure(item: ItemResponse, message: string) {
    failures.value.push({ id: item.id, name: item.name, message })
  }

  async function capture(item: ItemResponse, size: number): Promise<Blob> {
    let host = await renderItem(item, false)
    const box = captureBox(item.typeKey)

    const probe = item.typeKey === 'title' ? textRegion(host) : null
    if (probe) {
      const check = await rasterize(host, { ...box, scale: 1, probe })
      if ((check.probeOpaque ?? 0) === 0) {
        host = await renderItem(item, true)
        addWarning(FLAT_TEXT_NOTE)
      }
    }

    const textDriven = isTextDriven(item.typeKey)
    const result = await rasterize(host, {
      ...box,
      scale: (textDriven ? size * 2 : size) / box.width,
      trim: textDriven ? { size, paddingPct: TRIM_PADDING_PCT } : undefined,
    })
    result.warnings.forEach(addWarning)
    return result.blob
  }

  async function upload(item: ItemResponse, blob: Blob) {
    const file = new File([blob], iconFileName(item), { type: 'image/png' })
    uploaded.value.push(await uploadItemIcon(item.id, file))
  }

  async function run(items: ItemResponse[], options: { size: number }) {
    if (running.value) return
    abort = false
    reset()
    running.value = true
    total.value = items.length

    const pending = new Set<Promise<void>>()

    try {
      for (const item of items) {
        if (abort) break
        currentName.value = item.name

        while (pending.size >= UPLOAD_CONCURRENCY) await Promise.race(pending)

        let blob: Blob
        try {
          blob = await capture(item, options.size)
        } catch (err) {
          completed.value += 1
          addFailure(item, err instanceof Error ? err.message : 'Render failed')
          continue
        }

        const task: Promise<void> = upload(item, blob)
          .catch((err) => addFailure(item, parseApiError(err, 'Upload failed').message))
          .finally(() => {
            completed.value += 1
            pending.delete(task)
          })
        pending.add(task)
      }

      await Promise.all(pending)
    } finally {
      running.value = false
      currentName.value = null
    }
  }

  return { running, total, completed, currentName, failures, warnings, uploaded, run, cancel }
}
