<script setup lang="ts">
import { useOverlayMeasure } from '@/composables/useOverlayMeasure'
import type { Composition, ItemTypeKey, ModifierEffectSpec } from '@/types/api/items'
import type { TokenContext } from '@/utils/items'
import { computed, ref, watchEffect, type Component } from 'vue'
import type { EffectMeasure } from './effects/shared'
import { BLEED_TYPES, EFFECT_REGISTRY } from './effects/registry'

const props = defineProps<{
  spec: ModifierEffectSpec | null | undefined
  context?: TokenContext
  typeKey?: ItemTypeKey
  stackIndex?: number
  measureSelector?: string
  contentMask?: string | null
  hideStatCounters?: boolean
}>()

const compositions = computed<Composition[]>(() => props.spec?.compositions ?? [])
const ctx = computed<TokenContext>(() => props.context ?? {})

const overlayEl = ref<HTMLElement | null>(null)
const { overlayBox, box } = useOverlayMeasure(overlayEl, () => props.measureSelector)

const stack = computed(() => Math.max(0, Math.min(3, Math.round(props.stackIndex ?? 0))))
const bleeds = computed(() => compositions.value.some((c) => BLEED_TYPES.has(c.type)))

const measure = computed<EffectMeasure>(() => ({
  overlayBox: overlayBox.value,
  box: box.value,
  stack: stack.value,
  typeKey: props.typeKey,
}))

interface EffectLayer {
  index: number
  composition: Composition
  renderer: Component
}

const layers = computed<EffectLayer[]>(() => {
  const out: EffectLayer[] = []
  compositions.value.forEach((composition, index) => {
    if (props.hideStatCounters && composition.type === 'stat_counter') return
    const renderer = EFFECT_REGISTRY[composition.type]
    if (renderer) out.push({ index, composition, renderer })
  })
  return out
})

const maskedLayers = computed(() =>
  props.contentMask ? layers.value.filter((l) => !BLEED_TYPES.has(l.composition.type)) : layers.value,
)
const unmaskedLayers = computed(() =>
  props.contentMask ? layers.value.filter((l) => BLEED_TYPES.has(l.composition.type)) : [],
)

const maskStyle = computed<Record<string, string> | undefined>(() => {
  if (!props.contentMask) return undefined
  const b = box.value
  if (!b.w || !b.h) return undefined
  return {
    maskImage: props.contentMask,
    webkitMaskImage: props.contentMask,
    maskSize: `${b.w}px ${b.h}px`,
    webkitMaskSize: `${b.w}px ${b.h}px`,
    maskPosition: `${b.x}px ${b.y}px`,
    webkitMaskPosition: `${b.x}px ${b.y}px`,
    maskRepeat: 'no-repeat',
    webkitMaskRepeat: 'no-repeat',
  }
})

if (import.meta.env.DEV) {
  watchEffect(() => {
    for (const c of compositions.value) {
      if (!EFFECT_REGISTRY[c.type]) console.warn(`[effects] unknown composition type: ${c.type}`)
    }
  })
}
</script>

<template>
  <div
    v-if="compositions.length"
    ref="overlayEl"
    class="modifier-overlay"
    :class="{ 'modifier-overlay--bleed': bleeds }"
    aria-hidden="true"
  >
    <div v-if="maskedLayers.length" class="modifier-overlay__clip" :style="maskStyle">
      <component
        :is="layer.renderer"
        v-for="layer in maskedLayers"
        :key="layer.index"
        :composition="layer.composition"
        :ctx="ctx"
        :measure="measure"
      />
    </div>
    <component
      :is="layer.renderer"
      v-for="layer in unmaskedLayers"
      :key="layer.index"
      :composition="layer.composition"
      :ctx="ctx"
      :measure="measure"
    />
  </div>
</template>

<style scoped>
.modifier-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  border-radius: inherit;
}

.modifier-overlay--bleed {
  overflow: visible;
}

.modifier-overlay__clip {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>
