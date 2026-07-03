<script setup lang="ts">
import { getItems } from '@/api/items'
import { getApiErrorMessage } from '@/api/client'
import BaseModal from '@/components/common/BaseModal.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import InventoryItemCell from '@/components/domain/InventoryItemCell.vue'
import ItemPreview from '@/components/domain/ItemPreview.vue'
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import type { ItemResponse, UserItemResponse } from '@/types/api/items'
import { rarityClass } from '@/utils/items'
import { computed, onMounted, ref, watch } from 'vue'

defineProps<{ loading?: boolean }>()

const emit = defineEmits<{
  close: []
  pick: [payload: { itemId: string; quantity: number }]
}>()

const PAGE_SIZE = 20

const items = ref<ItemResponse[]>([])
const fetching = ref(false)
const err = ref<string | null>(null)

const query = ref('')
const debounced = useDebouncedRef(query, 180)
const page = ref(1)

const selectedItem = ref<ItemResponse | null>(null)
const quantity = ref(1)

const rarityRank: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
}

const filtered = computed(() => {
  const q = debounced.value.trim().toLowerCase()
  const base = items.value.filter((i) => i.active && !i.deprecated && i.tradeable)
  const matched = q
    ? base.filter((i) =>
        i.name.toLowerCase().includes(q)
        || i.typeKey.toLowerCase().includes(q),
      )
    : base
  return matched.slice().sort((a, b) => {
    const r = (rarityRank[a.rarity] ?? 0) - (rarityRank[b.rarity] ?? 0)
    if (r !== 0) return r
    return a.name.localeCompare(b.name)
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))

const paged = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filtered.value.slice(start, start + PAGE_SIZE)
})

watch(debounced, () => { page.value = 1 })
watch(totalPages, (n) => {
  if (page.value > n) page.value = n
})

function wrapAsUserItem(item: ItemResponse): UserItemResponse {
  return {
    linkId: item.id,
    item,
    modifiers: [],
    serialNumber: null,
    quantity: 1,
    source: 'manual',
    sourceId: null,
    awardedByStaffId: null,
    reason: null,
    awardedAt: '',
  }
}

async function load() {
  fetching.value = true
  err.value = null
  try {
    items.value = await getItems({ tradeable: true })
  } catch (e) {
    err.value = getApiErrorMessage(e, 'Failed to load items')
  } finally {
    fetching.value = false
  }
}

onMounted(load)

function selectItem(item: ItemResponse) {
  selectedItem.value = item
  quantity.value = 1
}

function selectByLinkId(linkId: string) {
  const item = items.value.find((i) => i.id === linkId)
  if (item) selectItem(item)
}

function clearSelection() {
  selectedItem.value = null
  quantity.value = 1
}

function confirm() {
  const item = selectedItem.value
  if (!item) return
  const qty = Math.max(1, Math.floor(quantity.value || 1))
  emit('pick', { itemId: item.id, quantity: qty })
}
</script>

<template>
  <BaseModal :open="true" title="Add reward" @close="emit('close')">
    <div class="item-picker">
      <template v-if="!selectedItem">
        <input class="item-picker__search" v-model="query" type="search" autofocus
          placeholder="Search by name or type" />

        <p v-if="err" class="item-picker__error" role="alert">{{ err }}</p>

        <div v-if="fetching" class="item-picker__grid">
          <div v-for="i in PAGE_SIZE" :key="i" class="item-picker__skeleton">
            <SkeletonLoader variant="card" />
          </div>
        </div>

        <p v-else-if="paged.length === 0" class="item-picker__empty">
          {{
            debounced.trim()
              ? 'No items match that search.'
              : 'Sorry, no tradeable items are currently active. Come back soon!'
          }}
        </p>

        <div v-else class="item-picker__grid">
          <InventoryItemCell v-for="item in paged" :key="item.id"
            :user-item="wrapAsUserItem(item)"
            :selected="selectedItem?.id === item.id"
            @select="selectByLinkId" />
        </div>

        <div v-if="!fetching && totalPages > 1" class="item-picker__pagination">
          <PaginationControls :page="page" :total-pages="totalPages"
            @update:page="page = $event" />
        </div>
      </template>

      <template v-else>
        <div class="item-picker__selected">
          <span class="item-picker__selected-art" :class="rarityClass(selectedItem.rarity)">
            <ItemPreview :item="selectedItem" selected />
          </span>
          <div class="item-picker__selected-meta">
            <p class="item-picker__name">{{ selectedItem.name }}</p>
            <p class="item-picker__sub">
              <span class="item-picker__type">{{ selectedItem.typeKey.replace(/_/g, ' ') }}</span>
              <span class="item-picker__rarity" :class="rarityClass(selectedItem.rarity)">
                {{ selectedItem.rarity }}
              </span>
            </p>
          </div>
          <button type="button" class="item-picker__change" @click="clearSelection">
            Change
          </button>
        </div>

        <label class="item-picker__field">
          <span>Quantity</span>
          <input v-model.number="quantity" type="number" min="1" step="1" />
        </label>

        <div class="item-picker__actions">
          <button type="button" class="item-picker__cancel" @click="emit('close')">Cancel</button>
          <button type="button" class="item-picker__confirm" :disabled="loading || !selectedItem"
            @click="confirm">
            {{ loading ? 'Adding...' : 'Add reward' }}
          </button>
        </div>
      </template>
    </div>
  </BaseModal>
</template>

<style scoped>
.item-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  width: min(680px, 100%);
  min-height: 0;
}

.item-picker__search {
  width: 100%;
  padding: 10px 12px;
  font-family: var(--font-sans);
  font-size: var(--text-body);
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  outline: none;
  transition: border-color 120ms ease;
  flex-shrink: 0;
}

.item-picker__search:focus {
  border-color: var(--page-accent, var(--accent));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--page-accent, var(--accent)) 20%, transparent);
}

.item-picker__error {
  margin: 0;
  padding: 8px 10px;
  font-size: var(--text-caption);
  color: var(--error);
  background: color-mix(in srgb, var(--error) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 35%, transparent);
  border-radius: 3px;
  flex-shrink: 0;
}

.item-picker__empty {
  margin: 0;
  padding: var(--space-md);
  text-align: center;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.item-picker__grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-sm);
  padding: 2px;
  overflow-y: auto;
  min-height: 0;
  flex: 1 1 auto;
}

@media (max-width: 600px) {
  .item-picker__grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 420px) {
  .item-picker__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.item-picker__skeleton {
  aspect-ratio: 1 / 1;
}

.item-picker__pagination {
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.item-picker__name {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.item-picker__sub {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.item-picker__type {
  text-transform: capitalize;
}

.item-picker__rarity {
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.item-picker__rarity.rarity--common { color: var(--text-tertiary); }
.item-picker__rarity.rarity--uncommon { color: var(--success); }
.item-picker__rarity.rarity--rare { color: var(--info); }
.item-picker__rarity.rarity--epic { color: var(--accent-overall); }
.item-picker__rarity.rarity--legendary { color: var(--tier-gold); }
.item-picker__rarity.rarity--mythic { color: var(--error); }

.item-picker__selected {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  gap: var(--space-sm);
  align-items: center;
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--bg-overlay);
}

.item-picker__selected-art {
  --rarity-color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  background: var(--bg-base);
  border: 1px solid var(--rarity-color);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.item-picker__selected-art.rarity--common { --rarity-color: var(--text-tertiary); }
.item-picker__selected-art.rarity--uncommon { --rarity-color: var(--success); }
.item-picker__selected-art.rarity--rare { --rarity-color: var(--info); }
.item-picker__selected-art.rarity--epic { --rarity-color: var(--accent-overall); }
.item-picker__selected-art.rarity--legendary { --rarity-color: var(--tier-gold); }
.item-picker__selected-art.rarity--mythic { --rarity-color: var(--error); }

.item-picker__selected-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.item-picker__change {
  padding: 4px 10px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease;
}

.item-picker__change:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.item-picker__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-picker__field > span {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.item-picker__field input[type="number"] {
  width: 100px;
  padding: 8px 10px;
  font-family: var(--font-mono);
  font-size: var(--text-body);
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  outline: none;
  transition: border-color 120ms ease;
}

.item-picker__field input[type="number"]:focus {
  border-color: var(--page-accent, var(--accent));
}

.item-picker__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding-top: var(--space-md);
  border-top: 1px solid var(--bg-overlay);
}

.item-picker__cancel,
.item-picker__confirm {
  padding: 8px 16px;
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-radius: 3px;
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
}

.item-picker__cancel {
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--bg-overlay);
}

.item-picker__cancel:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.item-picker__confirm {
  color: var(--bg-base);
  background: var(--page-accent, var(--accent));
  border: 1px solid var(--page-accent, var(--accent));
}

.item-picker__confirm:hover:not(:disabled) {
  background: color-mix(in srgb, var(--page-accent, var(--accent)) 88%, var(--text-primary));
}

.item-picker__confirm:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
