import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'
import type { ContentBox, OverlayBox } from '@/components/domain/effects/shared'

export function useOverlayMeasure(
  overlayEl: Ref<HTMLElement | null>,
  measureSelector: () => string | undefined,
) {
  const overlayBox = ref<OverlayBox>({ w: 0, h: 0 })
  const contentBox = ref<ContentBox | null>(null)
  let ro: ResizeObserver | null = null
  let observedTarget: Element | null = null

  function measure() {
    const el = overlayEl.value
    if (!el) return
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return
    overlayBox.value = { w: r.width, h: r.height }
    let target: Element | null = null
    const selector = measureSelector()
    if (selector && el.parentElement) {
      for (const part of selector.split(',')) {
        target = el.parentElement.querySelector(part.trim())
        if (target) break
      }
    }
    if (target && target !== observedTarget && ro) {
      if (observedTarget) ro.unobserve(observedTarget)
      ro.observe(target)
      observedTarget = target
    }
    const tr = target?.getBoundingClientRect()
    contentBox.value = tr && tr.width && tr.height
      ? { x: tr.left - r.left, y: tr.top - r.top, w: tr.width, h: tr.height }
      : null
  }

  onMounted(() => {
    ro = new ResizeObserver(() => measure())
    if (overlayEl.value) ro.observe(overlayEl.value)
    measure()
  })
  onUnmounted(() => ro?.disconnect())

  const box = computed<ContentBox>(() => contentBox.value ?? { x: 0, y: 0, ...overlayBox.value })

  return { overlayBox, box }
}
