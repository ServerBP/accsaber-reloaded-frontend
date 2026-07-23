<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BorderCompositionPreview from '@/components/domain/BorderCompositionPreview.vue'
import CrateContentsList from '@/components/domain/CrateContentsList.vue'
import CrateModifierList from '@/components/domain/CrateModifierList.vue'
import CratePreviewModal from '@/components/domain/CratePreviewModal.vue'
import FragmentedItem from '@/components/domain/FragmentedItem.vue'
import ItemPreview from '@/components/domain/ItemPreview.vue'
import ModifierChip from '@/components/domain/ModifierChip.vue'
import ModifierCompositions from '@/components/domain/ModifierCompositions.vue'
import { useModifierColor } from '@/composables/useModifierColor'
import { useItemModifierStore } from '@/stores/itemModifiers'
import { useItemTypeStore } from '@/stores/itemTypes'
import { useThemeStore } from '@/stores/theme'
import type { BorderColorValue, BorderShapeValue, CrateContentResponse, CrateModifierResponse, ItemModifierRef, ItemResponse, ItemVariant, UnusualEffectResponse, UserItemResponse } from '@/types/api/items'
import { formatEssence } from '@/utils/essence'
import { formatRelativeDate } from '@/utils/formatters'
import { shapeSilhouetteMask } from '@/utils/shapeSilhouette'
import {
  buildEffectLayers,
  displayItemName,
  isEquippableTypeKey,
  rarityClass,
  readBorderColorValue,
  readBorderShapeValue,
  readFragmentSpec,
  readItemVariants,
  readThemeValue,
  resolveItemVariant,
  sortModifiersByKey,
  userItemTokenContext,
} from '@/utils/items'
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  userItem: UserItemResponse | null
  isOwnProfile: boolean
  equipped: boolean
  equippedVariantKey?: string | null
  busy?: boolean
  locked?: boolean
  downloading?: boolean
  crateContents?: CrateContentResponse[]
  crateContentsLoading?: boolean
  crateModifiers?: CrateModifierResponse[]
  crateModifiersLoading?: boolean
  crateEffects?: UnusualEffectResponse[]
  crateEffectsLoading?: boolean
  ownedItemIds?: Set<string>
  equippedBorderShape?: BorderShapeValue | null
  equippedBorderColor?: BorderColorValue | null
  avatarUrl?: string | null
}>()

const emit = defineEmits<{
  equip: [linkId: string]
  unequip: [typeKey: string]
  disintegrate: [linkId: string]
  download: [linkId: string]
  openCrate: [linkId: string]
  applyThemeMode: [linkId: string, alt: boolean]
  selectVariant: [linkId: string, variantKey: string]
  loadCrateEffects: []
}>()

const itemTypeStore = useItemTypeStore()
const modifierStore = useItemModifierStore()
const themeStore = useThemeStore()

const item = computed(() => props.userItem?.item ?? null)
const isCrate = computed(() => item.value?.typeKey === 'crate')

const themeValue = computed(() =>
  item.value?.typeKey === 'theme' ? readThemeValue(item.value.value) : null,
)
const themeModes = computed(() => {
  const tv = themeValue.value
  if (!tv?.altTokens) return null
  const label = (t: Record<string, string>) => (t.base === 'light' ? 'Light' : 'Dark')
  return [
    { alt: false, label: label(tv.tokens) },
    { alt: true, label: label(tv.altTokens) },
  ]
})
const activeThemeMode = computed<boolean | null>(() => {
  const tv = themeValue.value
  if (!tv?.altTokens || !props.equipped || !themeStore.activeTokens) return null
  const active = JSON.stringify(themeStore.activeTokens)
  if (active === JSON.stringify(tv.altTokens)) return true
  if (active === JSON.stringify(tv.tokens)) return false
  return null
})
const itemVariants = computed<ItemVariant[] | null>(() =>
  item.value ? readItemVariants(item.value.value) : null,
)
const activeVariantKey = computed<string | null>(() => {
  if (!itemVariants.value || !props.equipped) return null
  return props.equippedVariantKey ?? itemVariants.value[0]?.key ?? null
})
const previewItem = computed<ItemResponse | null>(() => {
  const it = item.value
  if (!it || !itemVariants.value) return it
  const key = activeVariantKey.value ?? itemVariants.value[0]?.key
  if (!key) return it
  return {
    ...it,
    value: resolveItemVariant(it.value as { variants?: ItemVariant[] }, key) as ItemResponse['value'],
  }
})

const isBorderShapeItem = computed(() => item.value?.typeKey === 'profile_border_shape')
const isBorderColorItem = computed(() => item.value?.typeKey === 'profile_border_color')

const selectedShapeValue = computed<BorderShapeValue | null>(() =>
  isBorderShapeItem.value && previewItem.value ? readBorderShapeValue(previewItem.value.value) : null,
)
const selectedColorValue = computed<BorderColorValue | null>(() =>
  isBorderColorItem.value && previewItem.value ? readBorderColorValue(previewItem.value.value) : null,
)

const compositionShape = computed<BorderShapeValue | null>(() =>
  isBorderShapeItem.value ? selectedShapeValue.value : (props.equippedBorderShape ?? null),
)
const compositionColor = computed<BorderColorValue | null>(() =>
  isBorderColorItem.value ? selectedColorValue.value : (props.equippedBorderColor ?? null),
)

const showComposition = computed(() =>
  props.isOwnProfile && (isBorderShapeItem.value || isBorderColorItem.value),
)

const effectMask = computed(() => {
  if (showComposition.value) return shapeSilhouetteMask(compositionShape.value)
  return isBorderShapeItem.value ? shapeSilhouetteMask(selectedShapeValue.value) : null
})

const modifiers = computed<ItemModifierRef[]>(() =>
  sortModifiersByKey(props.userItem?.modifiers ?? []),
)
const unusualEffect = computed(() => props.userItem?.unusualEffect ?? null)
const effectLayers = computed(() =>
  buildEffectLayers(props.userItem?.modifiers, props.userItem?.unusualEffect),
)
const fragmentSpec = computed(() => readFragmentSpec(props.userItem?.unusualEffect))
const tokenCtx = computed(() => props.userItem ? userItemTokenContext(props.userItem) : {})
const quantity = computed(() => props.userItem?.quantity ?? 1)

const { accent } = useModifierColor(modifiers)

const itemNameStyle = computed(() => (accent.value ? { color: accent.value } : undefined))

const fullItemName = computed(() => {
  const u = props.userItem
  if (!u) return ''
  return displayItemName(u.modifiers, u.item.name)
})

const typeName = computed(() => {
  if (!item.value) return ''
  return itemTypeStore.byKey.get(item.value.typeKey)?.name ?? item.value.typeKey
})

const equippable = computed(() => !!item.value && isEquippableTypeKey(item.value.typeKey))
const showEquipActions = computed(() => !props.locked && props.isOwnProfile && equippable.value && item.value?.active && !item.value.deprecated)
const showDownload = computed(() => !props.locked && props.isOwnProfile && !!item.value?.downloadable && item.value.active && !item.value.deprecated)

const essenceWorth = computed(() => item.value?.worth ?? 0)
const showDisintegrate = computed(() => !props.locked && props.isOwnProfile && essenceWorth.value > 0)
const disintegrateEssence = computed(() => essenceWorth.value * quantity.value)
const showOpenCrate = computed(
  () => isCrate.value && props.isOwnProfile && !props.locked && !!item.value?.active && !item.value.deprecated,
)

const previewOpen = ref(false)

function openPreview() {
  previewOpen.value = true
  emit('loadCrateEffects')
}

const CRATE_UNLOCK_MS = Date.UTC(2026, 6, 17, 15, 0, 0)
const CRATE_UNLOCK_MESSAGE = 'Crate opening unlocks Friday, July 17 at 3:00 PM UTC.'
const crateLocked = ref(Date.now() < CRATE_UNLOCK_MS)
let crateUnlockTimer: ReturnType<typeof setTimeout> | undefined
const showActions = computed(() => showEquipActions.value || showDownload.value || showDisintegrate.value || !item.value?.tradeable)
const hasMetaRows = computed(() => {
  if (!props.locked) return true
  return item.value?.unlockLevel != null || !!item.value?.requirement
})

const sourceLabel = computed(() => {
  if (!props.userItem) return ''
  switch (props.userItem.source) {
    case 'milestone': return 'Milestone reward'
    case 'milestone_set': return 'Milestone set reward'
    case 'campaign_milestone': return 'Campaign reward'
    case 'level': return `Level ${props.userItem.sourceId ?? '?'} reward`
    case 'trade': return 'Acquired via trade'
    case 'manual': return 'Awarded by staff'
    default: return props.userItem.source
  }
})

onMounted(() => {
  modifierStore.fetchModifiers()
  if (crateLocked.value) {
    const delay = CRATE_UNLOCK_MS - Date.now()
    if (delay <= 0) crateLocked.value = false
    else crateUnlockTimer = setTimeout(() => { crateLocked.value = false }, delay)
  }
})

onUnmounted(() => {
  if (crateUnlockTimer) clearTimeout(crateUnlockTimer)
})
</script>

<template>
  <div v-if="userItem && item" class="inv-detail">
    <div
      class="inv-detail__art"
      :class="[rarityClass(item.rarity), { 'inv-detail__art--title-fx': item.typeKey === 'title' }]"
    >
      <BorderCompositionPreview
        v-if="showComposition"
        :shape="compositionShape"
        :color="compositionColor"
        :avatar-url="avatarUrl"
      />
      <FragmentedItem v-else-if="fragmentSpec" :item="previewItem ?? item" :spec="fragmentSpec" :selected="true" />
      <ItemPreview v-else :item="previewItem ?? item" :selected="true" />
      <ModifierCompositions
        v-for="layer in effectLayers"
        :key="layer.key"
        :spec="layer.spec"
        :context="tokenCtx"
        :type-key="item?.typeKey"
        measure-selector=".border-composition, .title-renderer, .item-preview > *"
        :content-mask="effectMask"
      />
    </div>

    <div class="inv-detail__head">
      <span class="inv-detail__type">{{ typeName }}</span>
      <h3 class="inv-detail__name" :style="itemNameStyle">
        <span v-if="locked" class="inv-detail__name-lock" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
        {{ fullItemName }}
      </h3>
      <span class="inv-detail__rarity" :class="rarityClass(item.rarity)">{{ item.rarity }}</span>
    </div>

    <p v-if="item.description" class="inv-detail__description">{{ item.description }}</p>

    <div v-if="isCrate" class="inv-detail__crate-open-row">
      <span
        v-if="showOpenCrate"
        class="inv-detail__crate-open"
        :title="crateLocked ? CRATE_UNLOCK_MESSAGE : undefined"
      >
        <BaseButton
          variant="primary"
          size="md"
          :loading="busy"
          :disabled="crateLocked"
          @click="$emit('openCrate', userItem.linkId)"
        >
          Open crate
        </BaseButton>
      </span>

      <BaseButton size="md" @click="openPreview">Preview</BaseButton>
    </div>

    <CrateContentsList
      v-if="isCrate"
      :contents="crateContents ?? []"
      :loading="crateContentsLoading"
      :owned-item-ids="ownedItemIds"
    />

    <CrateModifierList
      v-if="isCrate && item"
      :modifiers="crateModifiers ?? []"
      :crate-id="item.id"
      :loading="crateModifiersLoading"
    />

    <CratePreviewModal
      v-if="isCrate"
      :open="previewOpen"
      :crate="item"
      :contents="crateContents ?? []"
      :contents-loading="crateContentsLoading"
      :modifiers="crateModifiers ?? []"
      :modifiers-loading="crateModifiersLoading"
      :effects="crateEffects ?? []"
      :effects-loading="crateEffectsLoading"
      :owned-item-ids="ownedItemIds"
      @close="previewOpen = false"
    />

    <div
      v-if="!locked && itemVariants && showEquipActions"
      class="inv-detail__theme-modes"
      role="group"
      aria-label="Variant"
    >
      <button
        v-for="variant in itemVariants"
        :key="variant.key"
        type="button"
        class="inv-detail__theme-mode"
        :class="{ 'inv-detail__theme-mode--active': activeVariantKey === variant.key }"
        :disabled="busy"
        @click="$emit('selectVariant', userItem.linkId, variant.key)"
      >
        {{ variant.label }}
      </button>
    </div>

    <div v-if="!locked && themeModes" class="inv-detail__theme-modes" role="group" aria-label="Theme mode">
      <button
        v-for="mode in themeModes"
        :key="mode.label"
        type="button"
        class="inv-detail__theme-mode"
        :class="{ 'inv-detail__theme-mode--active': activeThemeMode === mode.alt }"
        :disabled="busy"
        @click="$emit('applyThemeMode', userItem.linkId, mode.alt)"
      >
        {{ mode.label }}
      </button>
    </div>

    <dl v-if="hasMetaRows" class="inv-detail__meta">
      <div v-if="!locked" class="inv-detail__row">
        <dt>{{ modifiers.length > 1 ? 'Modifiers' : 'Modifier' }}</dt>
        <dd>
          <div v-if="modifiers.length" class="inv-detail__chips">
            <ModifierChip v-for="m in modifiers" :key="m.id" :modifier="m" />
          </div>
          <span v-else>-</span>
        </dd>
      </div>
      <div v-if="!locked && unusualEffect" class="inv-detail__row">
        <dt>Effect</dt>
        <dd>{{ unusualEffect.name || unusualEffect.key }}</dd>
      </div>
      <div v-if="!locked && quantity > 1" class="inv-detail__row">
        <dt>Quantity</dt>
        <dd class="inv-detail__mono">x{{ quantity }}</dd>
      </div>
      <div v-if="!locked && userItem.serialNumber != null" class="inv-detail__row">
        <dt>Serial</dt>
        <dd class="inv-detail__mono">#{{ userItem.serialNumber }}</dd>
      </div>
      <div v-if="!locked && !item?.tradeable" class="inv-detail__row">
        <dt>Source</dt>
        <dd>{{ sourceLabel }}</dd>
      </div>
      <div v-if="!locked" class="inv-detail__row">
        <dt>Awarded</dt>
        <dd>{{ formatRelativeDate(userItem.awardedAt) }}</dd>
      </div>
      <div v-if="!locked && userItem.reason" class="inv-detail__row">
        <dt>Reason</dt>
        <dd>{{ userItem.reason }}</dd>
      </div>
      <div v-if="locked && item.unlockLevel != null" class="inv-detail__row">
        <dt>Unlock</dt>
        <dd class="inv-detail__mono">Level {{ item.unlockLevel }}</dd>
      </div>
      <div v-if="locked && item.requirement" class="inv-detail__row">
        <dt>Requirement</dt>
        <dd>{{ item.requirement }}</dd>
      </div>
    </dl>

    <div v-if="locked" class="inv-detail__locked">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      Not in your inventory
    </div>

    <div v-if="!locked && item.deprecated" class="inv-detail__notice">This item has been deprecated.</div>

    <div v-if="showActions" class="inv-detail__actions">
      <div class="inv-detail__actions-row">
        <BaseButton
          v-if="showDownload"
          variant="primary"
          size="md"
          :loading="downloading"
          @click="$emit('download', userItem.linkId)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download
        </BaseButton>

        <BaseButton
          v-if="showEquipActions && !equipped"
          variant="primary"
          size="md"
          :loading="busy"
          @click="$emit('equip', userItem.linkId)"
        >
          Equip
        </BaseButton>
        <span v-else-if="showEquipActions" class="inv-detail__equipped">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Equipped
        </span>

        <BaseButton
          v-if="showDisintegrate"
          variant="destructive"
          size="md"
          :disabled="equipped || busy"
          @click="$emit('disintegrate', userItem.linkId)"
        >
          Disintegrate
          <span class="inv-detail__essence-yield">· +{{ formatEssence(disintegrateEssence) }}</span>
        </BaseButton>

        <span v-if="!item.tradeable" class="inv-detail__no-trade" aria-label="Untradeable">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
          Untradeable
        </span>
      </div>
    </div>
  </div>

  <div v-else class="inv-detail inv-detail--empty">
    <p>Select an item to see its details.</p>
  </div>
</template>

<style scoped>
.inv-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.inv-detail--empty {
  align-items: center;
  justify-content: center;
  min-height: 240px;
  color: var(--text-tertiary);
  font-size: var(--text-caption);
  text-align: center;
}

.inv-detail__art {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  max-height: 220px;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  overflow: hidden;
  --rarity-color: var(--text-tertiary);
}

.inv-detail__art--title-fx :deep(.item-preview) {
  position: relative;
  z-index: 1;
}

.inv-detail__art.rarity--common { --rarity-color: var(--text-tertiary); }
.inv-detail__art.rarity--uncommon { --rarity-color: var(--success); }
.inv-detail__art.rarity--rare { --rarity-color: var(--info); }
.inv-detail__art.rarity--epic { --rarity-color: var(--tier-apex); }
.inv-detail__art.rarity--legendary { --rarity-color: var(--tier-gold); }
.inv-detail__art.rarity--mythic { --rarity-color: var(--error); }

.inv-detail__art img {
  max-width: 75%;
  max-height: 75%;
  object-fit: contain;
}

.inv-detail__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.inv-detail__type {
  font-size: var(--text-caption);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.inv-detail__name {
  margin: 0;
  font-size: var(--text-section-heading);
  font-weight: 600;
  color: var(--text-primary);
}

.inv-detail__rarity {
  font-size: var(--text-caption);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.inv-detail__rarity.rarity--uncommon { color: var(--success); }
.inv-detail__rarity.rarity--rare { color: var(--info); }
.inv-detail__rarity.rarity--epic { color: var(--tier-apex); }
.inv-detail__rarity.rarity--legendary { color: var(--tier-gold); }
.inv-detail__rarity.rarity--mythic { color: var(--error); }

.inv-detail__description {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-body);
  line-height: 1.5;
}

.inv-detail__meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin: 0;
  padding: var(--space-sm) 0;
  border-top: 1px solid var(--bg-overlay);
  border-bottom: 1px solid var(--bg-overlay);
}

.inv-detail__row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-md);
  font-size: var(--text-caption);
}

.inv-detail__row dt {
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.inv-detail__row dd {
  margin: 0;
  color: var(--text-primary);
  text-align: right;
}

.inv-detail__mono {
  font-family: var(--font-mono);
}

.inv-detail__chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  justify-content: flex-end;
}

.inv-detail__theme-modes {
  display: flex;
  gap: var(--space-xs);
}

.inv-detail__theme-mode {
  flex: 1;
  padding: var(--space-xs) var(--space-sm);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
}

.inv-detail__theme-mode:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.inv-detail__theme-mode--active {
  color: var(--accent);
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.inv-detail__notice {
  padding: var(--space-sm) var(--space-md);
  background: color-mix(in srgb, var(--warning) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent);
  border-radius: var(--radius-card);
  color: var(--warning);
  font-size: var(--text-caption);
}

.inv-detail__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-sm);
}

.inv-detail__actions-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.inv-detail__crate-open-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.inv-detail__crate-open {
  display: inline-flex;
}

.inv-detail__essence-yield {
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}

.inv-detail__equipped {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: var(--radius-btn);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.inv-detail__name-lock {
  display: inline-flex;
  align-items: center;
  margin-right: var(--space-xs);
  color: var(--text-tertiary);
  vertical-align: -2px;
}

.inv-detail__locked {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  align-self: flex-start;
  padding: var(--space-xs) var(--space-sm);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 500;
  color: var(--text-tertiary);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  background: color-mix(in srgb, var(--bg-base) 60%, transparent);
}

.inv-detail__no-trade {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 500;
  color: var(--text-tertiary);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  background: color-mix(in srgb, var(--bg-base) 60%, transparent);
}
</style>
