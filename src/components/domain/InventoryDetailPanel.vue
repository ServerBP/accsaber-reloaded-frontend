<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import CrateContentsList from '@/components/domain/CrateContentsList.vue'
import ItemPreview from '@/components/domain/ItemPreview.vue'
import ModifierCompositions from '@/components/domain/ModifierCompositions.vue'
import { useModifierColor } from '@/composables/useModifierColor'
import { useItemModifierStore } from '@/stores/itemModifiers'
import { useItemTypeStore } from '@/stores/itemTypes'
import type { CrateContentResponse, ItemModifierRef, UserItemResponse } from '@/types/api/items'
import { formatRelativeDate } from '@/utils/formatters'
import {
  displayItemName,
  isEquippableTypeKey,
  rarityClass,
  sortModifiersByKey,
  userItemTokenContext,
} from '@/utils/items'
import { computed, onMounted } from 'vue'

const props = defineProps<{
  userItem: UserItemResponse | null
  isOwnProfile: boolean
  equipped: boolean
  busy?: boolean
  locked?: boolean
  crateContents?: CrateContentResponse[]
  crateContentsLoading?: boolean
}>()

defineEmits<{
  equip: [linkId: string]
  unequip: [typeKey: string]
}>()

const itemTypeStore = useItemTypeStore()
const modifierStore = useItemModifierStore()

const item = computed(() => props.userItem?.item ?? null)
const isCrate = computed(() => item.value?.typeKey === 'crate')
const modifiers = computed<ItemModifierRef[]>(() =>
  sortModifiersByKey(props.userItem?.modifiers ?? []),
)
const tokenCtx = computed(() => props.userItem ? userItemTokenContext(props.userItem) : {})
const quantity = computed(() => props.userItem?.quantity ?? 1)

const { accent, resolve } = useModifierColor(modifiers)

const itemNameStyle = computed(() => (accent.value ? { color: accent.value } : undefined))

const fullItemName = computed(() => {
  const u = props.userItem
  if (!u) return ''
  return displayItemName(u.modifiers, u.item.name)
})

function modifierChipStyle(m: ItemModifierRef) {
  const c = resolve(m)
  if (!c) return undefined
  return {
    color: c,
    borderColor: `color-mix(in srgb, ${c} 50%, transparent)`,
    background: `color-mix(in srgb, ${c} 10%, transparent)`,
  }
}

const typeName = computed(() => {
  if (!item.value) return ''
  return itemTypeStore.byKey.get(item.value.typeKey)?.name ?? item.value.typeKey
})

const equippable = computed(() => !!item.value && isEquippableTypeKey(item.value.typeKey))
const showEquipActions = computed(() => !props.locked && props.isOwnProfile && equippable.value && item.value?.active && !item.value.deprecated)
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
})
</script>

<template>
  <div v-if="userItem && item" class="inv-detail">
    <div class="inv-detail__art" :class="rarityClass(item.rarity)">
      <ItemPreview :item="item" :selected="true" />
      <ModifierCompositions
        v-for="m in modifiers"
        :key="m.id"
        :modifier="m"
        :context="tokenCtx"
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

    <CrateContentsList
      v-if="isCrate"
      :contents="crateContents ?? []"
      :loading="crateContentsLoading"
    />

    <dl v-if="hasMetaRows" class="inv-detail__meta">
      <div v-if="!locked" class="inv-detail__row">
        <dt>{{ modifiers.length > 1 ? 'Modifiers' : 'Modifier' }}</dt>
        <dd>
          <div v-if="modifiers.length" class="inv-detail__chips">
            <span
              v-for="m in modifiers"
              :key="m.id"
              class="inv-detail__chip"
              :style="modifierChipStyle(m)"
            >{{ m.name }}</span>
          </div>
          <span v-else>-</span>
        </dd>
      </div>
      <div v-if="!locked && quantity > 1" class="inv-detail__row">
        <dt>Quantity</dt>
        <dd class="inv-detail__mono">x{{ quantity }}</dd>
      </div>
      <div v-if="!locked && userItem.serialNumber != null" class="inv-detail__row">
        <dt>Serial</dt>
        <dd class="inv-detail__mono">#{{ userItem.serialNumber }}</dd>
      </div>
      <div v-if="!locked" class="inv-detail__row">
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

    <div v-if="showEquipActions || !item.tradeable" class="inv-detail__actions">
      <BaseButton
        v-if="showEquipActions && !equipped"
        variant="primary"
        size="md"
        :loading="busy"
        @click="$emit('equip', userItem.linkId)"
      >
        Equip
      </BaseButton>
      <BaseButton
        v-else-if="showEquipActions"
        size="md"
        :loading="busy"
        @click="$emit('unequip', item.typeKey)"
      >
        Unequip
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

.inv-detail__art.rarity--common { --rarity-color: var(--text-tertiary); }
.inv-detail__art.rarity--uncommon { --rarity-color: var(--success); }
.inv-detail__art.rarity--rare { --rarity-color: var(--info); }
.inv-detail__art.rarity--epic { --rarity-color: var(--accent-overall); }
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
.inv-detail__rarity.rarity--epic { color: var(--accent-overall); }
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

.inv-detail__chip {
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--bg-overlay);
  background: var(--bg-base);
  color: var(--text-secondary);
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
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
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
