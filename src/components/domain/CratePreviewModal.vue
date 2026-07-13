<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import EffectPreviewModal from '@/components/domain/EffectPreviewModal.vue'
import ItemPreview from '@/components/domain/ItemPreview.vue'
import ItemPreviewModal from '@/components/domain/ItemPreviewModal.vue'
import ModifierChip from '@/components/domain/ModifierChip.vue'
import UnusualEffectTile from '@/components/domain/UnusualEffectTile.vue'
import VariantSplitPreview from '@/components/domain/VariantSplitPreview.vue'
import { useItemModifierStore } from '@/stores/itemModifiers'
import type {
  CrateContentResponse,
  CrateModifierResponse,
  ItemResponse,
  UnusualEffectResponse,
} from '@/types/api/items'
import {
  groupCrateContentsByRarity,
  itemVariantPreviews,
  rarityClass,
  type ItemVariantPreview,
} from '@/utils/items'
import { formatChancePercent } from '@/utils/modifiers'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  crate: ItemResponse | null
  contents: CrateContentResponse[]
  contentsLoading?: boolean
  modifiers: CrateModifierResponse[]
  modifiersLoading?: boolean
  effects: UnusualEffectResponse[]
  effectsLoading?: boolean
  ownedItemIds?: Set<string>
  allowOpen?: boolean
}>()

defineEmits<{
  close: []
  previewOpen: []
}>()

const canPreviewOpen = computed(
  () => !!props.allowOpen && !props.contentsLoading && props.contents.length > 0,
)

const modifierStore = useItemModifierStore()

const groups = computed(() => groupCrateContentsByRarity(props.contents))

interface FlatTile {
  content: CrateContentResponse
  label: { rarity: string; chance: number } | null
  runEnd: boolean
  variants: ItemVariantPreview[] | null
}

const flatTiles = computed<FlatTile[]>(() =>
  groups.value.flatMap((g) =>
    g.items.map((content, i) => ({
      content,
      label: i === 0 ? { rarity: g.rarity, chance: g.chance } : null,
      runEnd: i === g.items.length - 1,
      variants: itemVariantPreviews(content.rewardItem),
    })),
  ),
)

function typeName(typeKey: string): string {
  return typeKey.replace(/^profile_/, '').replace(/_/g, ' ')
}

const hasUnusualModifier = computed(() =>
  props.modifiers.some((cm) => cm.modifier.key === 'unusual'),
)

function modifierDescription(key: string): string | null {
  return modifierStore.byKey.get(key)?.description ?? null
}

function isOwned(itemId: string): boolean {
  return props.ownedItemIds?.has(itemId) ?? false
}

const selectedItem = ref<ItemResponse | null>(null)
const itemOpen = ref(false)
const selectedEffect = ref<UnusualEffectResponse | null>(null)
const effectOpen = ref(false)

function openItem(item: ItemResponse) {
  selectedItem.value = item
  itemOpen.value = true
}

function openEffect(effect: UnusualEffectResponse) {
  selectedEffect.value = effect
  effectOpen.value = true
}

onMounted(() => {
  modifierStore.fetchModifiers()
})

const rootRef = ref<HTMLElement | null>(null)
const identityRef = ref<HTMLElement | null>(null)
const modifiersRef = ref<HTMLElement | null>(null)

function stretchColumnsToAdjacentRows(
  columns: HTMLElement[],
  tiles: NodeListOf<HTMLElement>,
): boolean {
  let changed = false
  for (const col of columns) {
    if (getComputedStyle(col).float === 'none') continue
    const rect = col.getBoundingClientRect()
    let target = rect.bottom
    for (const tile of tiles) {
      const t = tile.getBoundingClientRect()
      if (t.top < rect.bottom - 1 && t.bottom > target) target = t.bottom
    }
    if (target > rect.bottom + 1) {
      col.style.minHeight = `${Math.round(target - rect.top)}px`
      changed = true
    }
  }
  return changed
}

function extendColumnDividers() {
  const columns = [identityRef.value, modifiersRef.value].filter(
    (c): c is HTMLElement => !!c,
  )
  for (const col of columns) col.style.minHeight = ''
  const root = rootRef.value
  if (!root || !columns.length) return
  const tiles = root.querySelectorAll<HTMLElement>('.crate-preview__tile')
  if (!tiles.length) return
  for (let pass = 0; pass < 4 && stretchColumnsToAdjacentRows(columns, tiles); pass++) {
    continue
  }
}

let resizeFrame = 0
function onResize() {
  cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(extendColumnDividers)
}

watch(
  () => [props.open, props.contents, props.modifiers, props.effects] as const,
  async ([open]) => {
    if (!open) return
    await nextTick()
    extendColumnDividers()
  },
  { immediate: true },
)

watch(
  () => props.open,
  (open) => {
    if (open) window.addEventListener('resize', onResize)
    else window.removeEventListener('resize', onResize)
  },
  { immediate: true },
)

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  cancelAnimationFrame(resizeFrame)
})
</script>

<template>
  <BaseModal :open="open" title="Crate Preview" max-width="1200px" @close="$emit('close')">
    <div v-if="crate" ref="rootRef" class="crate-preview">
      <aside ref="identityRef" class="crate-preview__identity">
        <div class="crate-preview__art" :class="rarityClass(crate.rarity)">
          <ItemPreview :item="crate" />
        </div>
        <h3 class="crate-preview__name">{{ crate.name }}</h3>
        <span class="crate-preview__rarity" :class="rarityClass(crate.rarity)">
          {{ crate.rarity }}
        </span>
        <p v-if="crate.description" class="crate-preview__description">{{ crate.description }}</p>
      </aside>

      <aside ref="modifiersRef" class="crate-preview__modifiers" aria-label="Possible modifiers">
        <div class="crate-preview__section-head">
          <span class="crate-preview__section-title">Modifiers</span>
        </div>

        <div v-if="modifiersLoading" class="crate-preview__modifiers-body">
          <SkeletonLoader v-for="i in 2" :key="i" variant="table-row" />
        </div>

        <p v-else-if="!modifiers.length" class="crate-preview__empty">
          No modifiers roll on this crate.
        </p>

        <ul v-else class="crate-preview__modifiers-body">
          <li v-for="cm in modifiers" :key="cm.modifier.id" class="crate-preview__modifier-row">
            <span class="crate-preview__modifier-head">
              <ModifierChip :modifier="cm.modifier" />
              <span class="crate-preview__modifier-chance">{{ formatChancePercent(cm.dropChance) }}</span>
            </span>
            <span v-if="modifierDescription(cm.modifier.key)" class="crate-preview__modifier-desc">
              {{ modifierDescription(cm.modifier.key) }}
            </span>
          </li>
        </ul>
      </aside>

      <section class="crate-preview__items" aria-label="Possible items">
        <div class="crate-preview__section-head">
          <span class="crate-preview__section-title">Items</span>
          <span v-if="!contentsLoading && contents.length" class="crate-preview__section-count">
            {{ contents.length }} {{ contents.length === 1 ? 'item' : 'items' }}
          </span>
        </div>

        <div v-if="contentsLoading" class="crate-preview__items-body">
          <SkeletonLoader v-for="i in 3" :key="i" variant="table-row" />
        </div>

        <p v-else-if="!contents.length" class="crate-preview__empty">
          Its contents are a mystery for now.
        </p>

        <div v-else class="crate-preview__items-body">
          <button
            v-for="t in flatTiles"
            :key="t.content.rewardItem.id"
            type="button"
            class="crate-preview__tile"
            :class="[rarityClass(t.content.rewardItem.rarity), { 'crate-preview__tile--run-end': t.runEnd }]"
            :title="`${t.content.rewardItem.name} - ${formatChancePercent(t.content.dropChance)} (click to preview)`"
            @click="openItem(t.content.rewardItem)"
          >
            <span v-if="t.label" class="crate-preview__run-label">
              <span class="crate-preview__run-label-name">{{ t.label.rarity }}</span>
              <span class="crate-preview__run-label-chance">{{ formatChancePercent(t.label.chance) }}</span>
            </span>
            <span class="crate-preview__tile-art">
              <VariantSplitPreview
                v-if="t.variants"
                :item="t.content.rewardItem"
                :variants="t.variants"
              />
              <ItemPreview v-else :item="t.content.rewardItem" />
              <span
                v-if="isOwned(t.content.rewardItem.id)"
                class="crate-preview__tile-owned"
                role="img"
                aria-label="You own this"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            </span>
            <span class="crate-preview__tile-name">{{ t.content.rewardItem.name }}</span>
            <span class="crate-preview__tile-type">{{ typeName(t.content.rewardItem.typeKey) }}</span>
            <span v-if="t.variants" class="crate-preview__tile-variants">
              {{ t.variants.length }} variants!
            </span>
          </button>
        </div>
      </section>

      <section
        v-if="hasUnusualModifier"
        class="crate-preview__effects"
        aria-label="Possible unusual effects"
      >
        <div class="crate-preview__section-head">
          <span class="crate-preview__section-title">Unusual Effects</span>
          <span v-if="!effectsLoading && effects.length" class="crate-preview__section-count">
            On an Unusual roll you get one of these, equal chance.
          </span>
        </div>

        <div v-if="effectsLoading" class="crate-preview__effects-grid">
          <SkeletonLoader v-for="i in 2" :key="i" variant="table-row" />
        </div>

        <p v-else-if="!effects.length" class="crate-preview__empty">
          Rolls the default Unusual sparkle.
        </p>

        <ul v-else class="crate-preview__effects-grid">
          <li v-for="effect in effects" :key="effect.id">
            <button
              type="button"
              class="crate-preview__effect-btn"
              :title="`${effect.name} (click to preview)`"
              @click="openEffect(effect)"
            >
              <UnusualEffectTile :name="effect.name" :effect-spec="effect.effectSpec" />
            </button>
          </li>
        </ul>
      </section>
    </div>

    <ItemPreviewModal :open="itemOpen" :item="selectedItem" @close="itemOpen = false" />
    <EffectPreviewModal :open="effectOpen" :effect="selectedEffect" @close="effectOpen = false" />

    <template v-if="allowOpen" #footer>
      <BaseButton variant="primary" :disabled="!canPreviewOpen" @click="$emit('previewOpen')">
        Preview open
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.crate-preview {
  display: flow-root;
}

.crate-preview__identity {
  float: left;
  width: 200px;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-right: var(--space-lg);
  border-right: 1px solid var(--bg-overlay);
  margin: 0 var(--space-lg) 0 0;
}

.crate-preview__art {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--bg-base);
  border: 1px solid color-mix(in srgb, var(--rarity-color) 35%, var(--bg-overlay));
  border-radius: var(--radius-card);
  overflow: hidden;
  --rarity-color: var(--text-tertiary);
}

.crate-preview__art :deep(img) {
  max-width: 75%;
  max-height: 75%;
  object-fit: contain;
}

.crate-preview__name {
  margin: 0;
  font-size: var(--text-card-title);
  font-weight: 600;
  color: var(--text-primary);
}

.crate-preview__rarity {
  font-size: var(--text-caption);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--rarity-color);
  --rarity-color: var(--text-tertiary);
}

.crate-preview__description {
  margin: 0;
  font-size: var(--text-caption);
  line-height: 1.5;
  color: var(--text-secondary);
}

.crate-preview__items {
  min-width: 0;
}

.crate-preview__items > .crate-preview__section-head {
  margin-bottom: var(--space-md);
}

.crate-preview__items-body {
  min-width: 0;
  font-size: 0;
}

.crate-preview__modifiers {
  float: right;
  max-width: 240px;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-left: var(--space-lg);
  border-left: 1px solid var(--bg-overlay);
  margin: 0 0 0 var(--space-lg);
}

.crate-preview__modifiers-body {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.crate-preview__modifier-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm) 0;
}

.crate-preview__modifier-row + .crate-preview__modifier-row {
  border-top: 1px solid color-mix(in srgb, var(--bg-overlay) 60%, transparent);
}

.crate-preview__modifier-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

.crate-preview__modifier-desc {
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--text-secondary);
}

.crate-preview__modifier-chance {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.crate-preview__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
}

.crate-preview__section-title {
  font-size: var(--text-caption);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.crate-preview__section-count {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.crate-preview__empty {
  margin: 0;
  padding: var(--space-md);
  text-align: center;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.crate-preview__run-label {
  position: absolute;
  top: -22px;
  left: 0;
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-sm);
  white-space: nowrap;
}

.crate-preview__run-label-name {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--rarity-color);
}

.crate-preview__run-label-chance {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.crate-preview__tile {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  width: 116px;
  min-width: 0;
  vertical-align: top;
  margin: 26px var(--space-sm) var(--space-sm) 0;
  padding-top: var(--space-xs);
  --rarity-color: var(--text-tertiary);
  appearance: none;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.crate-preview__tile:hover .crate-preview__tile-art {
  border-color: color-mix(in srgb, var(--rarity-color) 75%, var(--text-primary));
}

.crate-preview__effect-btn {
  appearance: none;
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  display: block;
}

.crate-preview__effect-btn:hover :deep(.ue-tile__frame) {
  border-color: var(--text-tertiary);
}

.crate-preview__tile::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: calc(-1 * var(--space-sm));
  height: 1px;
  background: color-mix(in srgb, var(--rarity-color) 40%, var(--bg-overlay));
}

.crate-preview__tile--run-end::before {
  right: 0;
}

.crate-preview__tile-art {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--bg-base);
  border: 1px solid color-mix(in srgb, var(--rarity-color) 35%, var(--bg-overlay));
  border-radius: var(--radius-input);
  overflow: hidden;
}

.crate-preview__tile-art :deep(img) {
  max-width: 75%;
  max-height: 75%;
  object-fit: contain;
}

.crate-preview__tile-owned {
  position: absolute;
  top: 3px;
  right: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--success);
  background: color-mix(in srgb, var(--bg-base) 80%, transparent);
  border-radius: var(--radius-pill);
}

.crate-preview__tile-name {
  font-size: 0.6875rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.crate-preview__tile-type {
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.crate-preview__tile-variants {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--tier-gold);
  white-space: nowrap;
}

.crate-preview__effects {
  clear: both;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-top: var(--space-md);
  border-top: 1px solid var(--bg-overlay);
}

.crate-preview__effects-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

.crate-preview__art.rarity--common,
.crate-preview__rarity.rarity--common,
.crate-preview__tile.rarity--common { --rarity-color: var(--text-tertiary); }
.crate-preview__art.rarity--uncommon,
.crate-preview__rarity.rarity--uncommon,
.crate-preview__tile.rarity--uncommon { --rarity-color: var(--success); }
.crate-preview__art.rarity--rare,
.crate-preview__rarity.rarity--rare,
.crate-preview__tile.rarity--rare { --rarity-color: var(--info); }
.crate-preview__art.rarity--epic,
.crate-preview__rarity.rarity--epic,
.crate-preview__tile.rarity--epic { --rarity-color: var(--tier-apex); }
.crate-preview__art.rarity--legendary,
.crate-preview__rarity.rarity--legendary,
.crate-preview__tile.rarity--legendary { --rarity-color: var(--tier-gold); }
.crate-preview__art.rarity--mythic,
.crate-preview__rarity.rarity--mythic,
.crate-preview__tile.rarity--mythic { --rarity-color: var(--error); }

@media (max-width: 767px) {
  .crate-preview__identity,
  .crate-preview__modifiers {
    float: none;
    width: auto;
    max-width: none;
    padding: 0;
    border: none;
    margin: 0 0 var(--space-lg);
  }

  .crate-preview__art {
    max-width: 200px;
  }
}
</style>
