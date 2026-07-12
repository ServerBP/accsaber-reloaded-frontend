<script setup lang="ts">
import { getApiErrorMessage } from '@/api/client'
import BaseModal from '@/components/common/BaseModal.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import InventoryItemCell from '@/components/domain/InventoryItemCell.vue'
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import { useItemTypeStore } from '@/stores/itemTypes'
import type { ItemResponse, UserItemResponse } from '@/types/api/items'
import { RARITY_ORDER } from '@/utils/items'
import { computed, onMounted, ref, watch } from 'vue'

const props = defineProps<{ excludeIds: string[] }>()

const emit = defineEmits<{
  close: []
  pick: [item: ItemResponse]
}>()

const PAGE_SIZE = 20

const itemTypeStore = useItemTypeStore()

const items = ref<ItemResponse[]>([])
const fetching = ref(false)
const err = ref<string | null>(null)

const query = ref('')
const debounced = useDebouncedRef(query, 180)
const page = ref(1)

const rarityRank = computed(() => {
  const map = new Map<string, number>()
  RARITY_ORDER.forEach((r, i) => map.set(r, i))
  return map
})

const excluded = computed(() => new Set(props.excludeIds))

const filtered = computed(() => {
  const q = debounced.value.trim().toLowerCase()
  const matched = items.value.filter((i) => {
    if (i.deprecated || excluded.value.has(i.id)) return false
    if (!q) return true
    return i.name.toLowerCase().includes(q) || i.typeKey.toLowerCase().includes(q)
  })
  return matched.slice().sort((a, b) => {
    const r = (rarityRank.value.get(a.rarity) ?? 0) - (rarityRank.value.get(b.rarity) ?? 0)
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
    unusualEffect: null,
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
    await itemTypeStore.fetchItemTypes()
    const { getAdminItems } = await import('@/api/admin/items')
    items.value = await getAdminItems({ includeInactive: false })
  } catch (e) {
    err.value = getApiErrorMessage(e, 'Failed to load items')
  } finally {
    fetching.value = false
  }
}

onMounted(load)

function pickByLinkId(linkId: string) {
  const item = items.value.find((i) => i.id === linkId)
  if (item) emit('pick', item)
}
</script>

<template>
  <BaseModal :open="true" title="Add bonus item" @close="emit('close')">
    <div class="event-item-picker">
      <input class="event-item-picker__search" v-model="query" type="search" autofocus
        placeholder="Search items by name" />

      <p v-if="err" class="event-item-picker__error" role="alert">{{ err }}</p>

      <div v-if="fetching" class="event-item-picker__grid">
        <div v-for="i in PAGE_SIZE" :key="i" class="event-item-picker__skeleton">
          <SkeletonLoader variant="card" />
        </div>
      </div>

      <p v-else-if="paged.length === 0" class="event-item-picker__empty">
        {{ items.length === 0 ? 'No items available.' : 'No items match that search.' }}
      </p>

      <div v-else class="event-item-picker__grid">
        <InventoryItemCell v-for="item in paged" :key="item.id" :user-item="wrapAsUserItem(item)"
          @select="pickByLinkId" />
      </div>

      <div v-if="!fetching && totalPages > 1" class="event-item-picker__pagination">
        <PaginationControls :page="page" :total-pages="totalPages" @update:page="page = $event" />
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.event-item-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  width: min(680px, 100%);
  min-height: 0;
}

.event-item-picker__search {
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

.event-item-picker__search:focus {
  border-color: var(--page-accent, var(--accent));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--page-accent, var(--accent)) 20%, transparent);
}

.event-item-picker__error {
  margin: 0;
  padding: 8px 10px;
  font-size: var(--text-caption);
  color: var(--error);
  background: color-mix(in srgb, var(--error) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 35%, transparent);
  border-radius: 3px;
  flex-shrink: 0;
}

.event-item-picker__empty {
  margin: 0;
  padding: var(--space-md);
  text-align: center;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.event-item-picker__grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-sm);
  padding: 2px;
  overflow-y: auto;
  min-height: 0;
  flex: 1 1 auto;
}

@media (max-width: 600px) {
  .event-item-picker__grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 420px) {
  .event-item-picker__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.event-item-picker__skeleton {
  aspect-ratio: 1 / 1;
}

.event-item-picker__pagination {
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}
</style>
