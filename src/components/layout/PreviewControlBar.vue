<script setup lang="ts">
import LevelBadge from '@/components/domain/LevelBadge.vue'
import PreviewModifierPicker from '@/components/domain/PreviewModifierPicker.vue'
import PreviewPicker from '@/components/domain/PreviewPicker.vue'
import PreviewVariantRow from '@/components/domain/PreviewVariantRow.vue'
import { useEquippedRenderProps } from '@/composables/useEquippedRenderProps'
import { usePreviewTheme } from '@/composables/usePreviewTheme'
import { useAuthStore } from '@/stores/auth'
import { useItemModifierStore } from '@/stores/itemModifiers'
import { usePreviewStore } from '@/stores/preview'
import type { ItemResponse, UnusualEffectResponse } from '@/types/api/items'
import { itemVariantPreviews, readItemVariants } from '@/utils/items'
import { isCreativesSubdomain } from '@/utils/subdomain'
import { computed, ref, watch } from 'vue'

const preview = usePreviewStore()
const authStore = useAuthStore()
const modifierStore = useItemModifierStore()

usePreviewTheme()

const visible = computed(() => isCreativesSubdomain)
const expanded = ref(false)

const loaded = ref(false)
const loading = ref(false)
const items = ref<ItemResponse[]>([])
const effects = ref<UnusualEffectResponse[]>([])

async function loadCatalog() {
  if (loaded.value || loading.value) return
  loading.value = true
  try {
    const { getStaffItems, getStaffUnusualEffects } = await import('@/api/staff/items')
    const [itemList, effectList] = await Promise.all([
      getStaffItems({ includeInactive: true }),
      getStaffUnusualEffects(true),
      modifierStore.fetchModifiers(),
    ])
    items.value = itemList
    effects.value = effectList
    loaded.value = true
  } catch {
    items.value = []
    effects.value = []
  } finally {
    loading.value = false
  }
}

watch(visible, (v) => { if (v) loadCatalog() }, { immediate: true })

function itemsOfType(typeKey: string): ItemResponse[] {
  return items.value.filter((i) => i.typeKey === typeKey)
}

const borderShapes = computed(() => itemsOfType('profile_border_shape'))
const borderColors = computed(() => itemsOfType('profile_border_color'))
const titles = computed(() => itemsOfType('title'))
const themes = computed(() => itemsOfType('theme'))

function findItem(id: string): ItemResponse | null {
  return items.value.find((i) => i.id === id) ?? null
}
function findEffect(id: string): UnusualEffectResponse | null {
  return effects.value.find((e) => e.id === id) ?? null
}

const borderShapeId = computed({
  get: () => preview.borderShape?.id ?? '',
  set: (id: string) => { preview.borderShape = findItem(id); preview.borderShapeVariant = null },
})
const borderShapeEffectId = computed({
  get: () => preview.borderShapeEffect?.id ?? '',
  set: (id: string) => { preview.borderShapeEffect = findEffect(id) },
})
const borderColorId = computed({
  get: () => preview.borderColor?.id ?? '',
  set: (id: string) => { preview.borderColor = findItem(id); preview.borderColorVariant = null },
})
const borderColorEffectId = computed({
  get: () => preview.borderColorEffect?.id ?? '',
  set: (id: string) => { preview.borderColorEffect = findEffect(id) },
})
const titleId = computed({
  get: () => preview.title?.id ?? '',
  set: (id: string) => { preview.title = findItem(id); preview.titleVariant = null },
})
const titleEffectId = computed({
  get: () => preview.titleEffect?.id ?? '',
  set: (id: string) => { preview.titleEffect = findEffect(id) },
})
const themeId = computed({
  get: () => preview.theme?.id ?? '',
  set: (id: string) => { preview.theme = findItem(id); preview.themeVariant = null },
})

const themeVariants = computed(() =>
  preview.theme ? itemVariantPreviews(preview.theme) ?? [] : [],
)

function variantsOf(item: ItemResponse | null) {
  return item ? readItemVariants(item.value) ?? [] : []
}

const borderShapeVariants = computed(() => variantsOf(preview.borderShape))
const borderColorVariants = computed(() => variantsOf(preview.borderColor))
const titleVariants = computed(() => variantsOf(preview.title))

const availableModifiers = computed(() =>
  modifierStore.modifiers.filter((m) => m.key !== 'unusual'),
)

const { titleValue, borderShapeValue, borderColorValue, titleEffects, borderEffects } =
  useEquippedRenderProps(() => preview.overrides)

const sampleAvatar = computed(() => authStore.userProfile?.avatarUrl || undefined)

const chips = computed(() => {
  const list: string[] = []
  if (preview.borderShape) list.push(preview.borderShape.name || 'Border shape')
  if (preview.borderColor) list.push(preview.borderColor.name || 'Border color')
  if (preview.title) list.push(preview.title.name || 'Title')
  if (preview.theme) list.push(preview.theme.name || 'Theme')
  for (const e of [preview.borderShapeEffect, preview.borderColorEffect, preview.titleEffect]) {
    if (e) list.push(e.name || e.key)
  }
  for (const m of [
    ...preview.borderShapeModifiers,
    ...preview.borderColorModifiers,
    ...preview.titleModifiers,
  ]) {
    list.push(m.name)
  }
  return list
})
</script>

<template>
  <div v-if="visible" class="preview-dock" role="region" aria-label="Cosmetic preview controls">
    <button
      type="button"
      class="preview-dock__toggle"
      :class="{ 'preview-dock__toggle--collapsed': !expanded }"
      :aria-label="expanded ? 'Hide settings' : 'Show settings'"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
          stroke-linejoin="round" />
      </svg>
    </button>

    <div class="preview-dock__reveal" :class="{ 'preview-dock__reveal--open': expanded }">
      <div class="preview-dock__reveal-clip">
        <div class="preview-dock__panel">
          <div class="preview-dock__stage">
        <LevelBadge
          :level="30"
          :current-xp="600"
          :required-xp="1000"
          :avatar-url="sampleAvatar"
          fallback-title="Preview"
          :equipped-title="titleValue"
          :equipped-border-shape="borderShapeValue"
          :equipped-border-color="borderColorValue"
          :title-effects="titleEffects"
          :border-effects="borderEffects"
          hide-progress
        />
      </div>

      <div class="preview-dock__controls">
        <div class="preview-dock__group">
          <span class="preview-dock__group-title">Border shape</span>
          <PreviewPicker v-model="borderShapeId" :items="borderShapes" placeholder="None" />
          <PreviewVariantRow :variants="borderShapeVariants" v-model="preview.borderShapeVariant" />
          <PreviewPicker v-model="borderShapeEffectId" :effects="effects" placeholder="No effect" />
          <PreviewModifierPicker v-model="preview.borderShapeModifiers" :modifiers="availableModifiers" />
        </div>

        <div class="preview-dock__group">
          <span class="preview-dock__group-title">Border color</span>
          <PreviewPicker v-model="borderColorId" :items="borderColors" placeholder="None" />
          <PreviewVariantRow :variants="borderColorVariants" v-model="preview.borderColorVariant" />
          <PreviewPicker v-model="borderColorEffectId" :effects="effects" placeholder="No effect" />
          <PreviewModifierPicker v-model="preview.borderColorModifiers" :modifiers="availableModifiers" />
        </div>

        <div class="preview-dock__group">
          <span class="preview-dock__group-title">Title</span>
          <PreviewPicker v-model="titleId" :items="titles" placeholder="None" />
          <PreviewVariantRow :variants="titleVariants" v-model="preview.titleVariant" />
          <PreviewPicker v-model="titleEffectId" :effects="effects" placeholder="No effect" />
          <PreviewModifierPicker v-model="preview.titleModifiers" :modifiers="availableModifiers" />
        </div>

        <div class="preview-dock__group">
          <span class="preview-dock__group-title">Theme</span>
          <PreviewPicker v-model="themeId" :items="themes" placeholder="None" />
          <PreviewVariantRow :variants="themeVariants" v-model="preview.themeVariant" />
        </div>
        </div>
        </div>
      </div>
    </div>

    <div class="preview-dock__bar">
      <span class="preview-dock__dot" aria-hidden="true"></span>
      <span class="preview-dock__label">Preview mode</span>
      <div class="preview-dock__chips">
        <span v-if="!chips.length" class="preview-dock__empty">No overrides selected</span>
        <span v-for="chip in chips" :key="chip" class="preview-dock__chip">{{ chip }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-dock {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 0;
  z-index: 95;
  width: min(680px, calc(100vw - 2 * var(--space-md)));
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-bottom: none;
  border-radius: var(--radius-card) var(--radius-card) 0 0;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.35);
}

.preview-dock__toggle {
  position: absolute;
  top: 6px;
  right: 8px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease;
}

.preview-dock__toggle:hover {
  color: var(--text-primary);
  background: var(--bg-surface);
}

.preview-dock__toggle svg {
  transition: transform 240ms ease;
}

.preview-dock__toggle--collapsed svg {
  transform: rotate(180deg);
}

.preview-dock__reveal {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 240ms ease;
}

.preview-dock__reveal--open {
  grid-template-rows: 1fr;
}

.preview-dock__reveal-clip {
  overflow: hidden;
  min-height: 0;
}

.preview-dock__panel {
  display: flex;
  gap: var(--space-lg);
  padding: var(--space-lg) var(--space-2xl) var(--space-md) var(--space-lg);
  align-items: flex-start;
}

.preview-dock__stage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 96px;
  flex-shrink: 0;
}

.preview-dock__controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-md) var(--space-lg);
  flex: 1;
}

.preview-dock__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
}

.preview-dock__group-title {
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  font-weight: 600;
}

.preview-dock__bar {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-2xl) var(--space-sm) var(--space-md);
  border-top: 1px solid var(--bg-overlay);
}

.preview-dock__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--info);
  flex-shrink: 0;
}

.preview-dock__label {
  font-size: var(--text-caption);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-primary);
  white-space: nowrap;
}

.preview-dock__chips {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.preview-dock__empty {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.preview-dock__chip {
  padding: 2px var(--space-sm);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .preview-dock__reveal {
    transition: none;
  }
  .preview-dock__toggle svg {
    transition: none;
  }
}

@media (max-width: 767px) {
  .preview-dock__stage {
    display: none;
  }
  .preview-dock__controls {
    grid-template-columns: 1fr;
  }
  .preview-dock__chips {
    display: none;
  }
}
</style>
