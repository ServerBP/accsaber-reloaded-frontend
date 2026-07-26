<script setup lang="ts">
import type { CampaignBackgroundPlacementInput } from '@/types/api/admin'
import type { CampaignBackgroundPlacement } from '@/types/api/campaigns'
import { backgroundPlacementStyle } from '@/utils/campaignLayout'
import { computed, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  imageUrl: string
  placement: CampaignBackgroundPlacement | null
  disabled?: boolean
}>()

const emit = defineEmits<{ commit: [placement: CampaignBackgroundPlacementInput] }>()

const NEUTRAL: CampaignBackgroundPlacement = { size: 100, x: 50, y: 50 }

const draft = ref<CampaignBackgroundPlacement>({ ...(props.placement ?? NEUTRAL) })

watch(
  () => props.placement,
  (next) => {
    if (next) draft.value = { ...next }
  },
)

const isStatic = computed(() => props.placement != null)

const previewStyle = computed(() =>
  backgroundPlacementStyle(props.imageUrl, isStatic.value ? draft.value : null),
)

const previewAspect = ref(16 / 9)
const imageAspect = ref(16 / 9)

onMounted(() => {
  const height = window.innerHeight - 64
  if (window.innerWidth > 0 && height > 0) {
    previewAspect.value = Math.min(3, Math.max(1, window.innerWidth / height))
  }
})

function onProbeLoad(event: Event) {
  const img = event.target as HTMLImageElement
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    imageAspect.value = img.naturalWidth / img.naturalHeight
  }
}

function clampOffset(value: number): number {
  return Math.round(Math.min(1000, Math.max(-1000, value)))
}

function clampScale(value: number): number {
  return Math.round(Math.min(1000, Math.max(1, value)))
}

function setField(field: keyof CampaignBackgroundPlacement, raw: string) {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return
  draft.value = {
    ...draft.value,
    [field]: field === 'size' ? clampScale(parsed) : clampOffset(parsed),
  }
}

function commit() {
  emit('commit', { ...draft.value })
}

function onFieldChange(field: keyof CampaignBackgroundPlacement, event: Event) {
  setField(field, (event.target as HTMLInputElement).value)
  commit()
}

interface DragState {
  pointerX: number
  pointerY: number
  originX: number
  originY: number
  width: number
  height: number
}

let drag: DragState | null = null

function onPointerDown(event: PointerEvent) {
  if (!isStatic.value || props.disabled || event.button !== 0) return
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  target.setPointerCapture(event.pointerId)
  drag = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    originX: draft.value.x,
    originY: draft.value.y,
    width: rect.width,
    height: rect.height,
  }
}

function onPointerMove(event: PointerEvent) {
  if (!drag) return
  const imageWidth = drag.width * (draft.value.size / 100)
  const imageHeight = imageWidth / imageAspect.value
  const spanX = drag.width - imageWidth
  const spanY = drag.height - imageHeight
  draft.value = {
    ...draft.value,
    x:
      Math.abs(spanX) < 1
        ? drag.originX
        : clampOffset(drag.originX + ((event.clientX - drag.pointerX) * 100) / spanX),
    y:
      Math.abs(spanY) < 1
        ? drag.originY
        : clampOffset(drag.originY + ((event.clientY - drag.pointerY) * 100) / spanY),
  }
}

function onPointerUp(event: PointerEvent) {
  if (!drag) return
  drag = null
  ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
  commit()
}

const fields = computed(() => [
  { key: 'size' as const, label: 'Scale', value: draft.value.size },
  { key: 'x' as const, label: 'X', value: draft.value.x },
  { key: 'y' as const, label: 'Y', value: draft.value.y },
])

function unpin() {
  emit('commit', {})
}
</script>

<template>
  <div class="placer">
    <img class="placer__probe" :src="imageUrl" alt="" aria-hidden="true" @load="onProbeLoad" />

    <div
      class="placer__preview"
      :class="{ 'placer__preview--draggable': isStatic && !disabled }"
      :style="{ ...previewStyle, aspectRatio: String(previewAspect) }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <span v-if="isStatic && !disabled" class="placer__grab-hint" aria-hidden="true">
        drag to reposition
      </span>
    </div>

    <template v-if="isStatic">
      <label class="placer__scale">
        <span class="placer__label">Scale {{ draft.size }}%</span>
        <input
          type="range"
          min="10"
          max="400"
          step="1"
          :value="Math.min(400, draft.size)"
          :disabled="disabled"
          @input="setField('size', ($event.target as HTMLInputElement).value)"
          @change="commit"
        />
      </label>

      <div class="placer__fields">
        <label v-for="f in fields" :key="f.key" class="placer__field">
          <span class="placer__label">{{ f.label }}</span>
          <input
            type="number"
            :min="f.key === 'size' ? 1 : -1000"
            max="1000"
            step="1"
            :value="f.value"
            :disabled="disabled"
            @change="onFieldChange(f.key, $event)"
          />
        </label>
      </div>

      <button type="button" class="placer__action" :disabled="disabled" @click="unpin">
        Unpin, fill the canvas again
      </button>
    </template>

    <template v-else>
      <p class="placer__hint">
        The background fills the canvas and crops to fit. Pin it to set an exact scale and position
        instead.
      </p>
      <button type="button" class="placer__action" :disabled="disabled" @click="commit">
        Pin placement
      </button>
    </template>
  </div>
</template>

<style scoped>
.placer {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.placer__probe {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.placer__preview {
  position: relative;
  width: 100%;
  background-color: var(--bg-base);
  background-size: cover;
  background-position: center;
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  overflow: hidden;
  touch-action: none;
}

.placer__preview--draggable {
  cursor: grab;
}

.placer__preview--draggable:active {
  cursor: grabbing;
}

.placer__grab-hint {
  position: absolute;
  left: 50%;
  bottom: 6px;
  transform: translateX(-50%);
  padding: 2px 8px;
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-base) 78%, transparent);
  border-radius: 2px;
  pointer-events: none;
}

.placer__label {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.placer__scale {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.placer__scale input {
  width: 100%;
  padding: 0;
  background: transparent;
  border: none;
  accent-color: var(--page-accent);
}

.placer__fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.placer__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.placer__field input {
  width: 100%;
  min-width: 0;
  padding: 7px 8px;
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  outline: none;
  transition: border-color 120ms ease;
}

.placer__field input:focus {
  border-color: var(--page-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--page-accent) 20%, transparent);
}

.placer__hint {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  line-height: 1.4;
}

.placer__action {
  align-self: flex-start;
  padding: 7px 12px;
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  cursor: pointer;
  transition:
    color 120ms ease,
    border-color 120ms ease;
}

.placer__action:hover:not(:disabled) {
  color: var(--page-accent);
  border-color: var(--page-accent);
}

.placer__action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
