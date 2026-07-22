<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import InventoryItemCell from '@/components/domain/InventoryItemCell.vue'
import type { UserItemResponse } from '@/types/api/items'

const props = defineProps<{
  items: UserItemResponse[]
  loading: boolean
  page: number
  totalPages: number
  search: string
  selectedLinkId: string | null
  disabledLinkIds: Set<string>
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  'update:page': [page: number]
  select: [item: UserItemResponse]
}>()

function onSelect(linkId: string) {
  if (props.disabledLinkIds.has(linkId)) return
  const item = props.items.find((i) => i.linkId === linkId)
  if (item) emit('select', item)
}
</script>

<template>
  <div class="item-picker">
    <SearchBox
      :model-value="search"
      placeholder="Search your tradeable items..."
      @update:model-value="emit('update:search', $event)"
    />

    <div v-if="loading" class="item-picker__grid">
      <SkeletonLoader v-for="i in 12" :key="i" variant="card" />
    </div>

    <EmptyState
      v-else-if="items.length === 0"
      :message="search ? 'No listable items match your search.' : 'You have no tradeable items to list.'"
    />

    <template v-else>
      <div class="item-picker__grid">
        <div
          v-for="userItem in items"
          :key="userItem.linkId"
          class="item-picker__cell"
          :title="disabledLinkIds.has(userItem.linkId) ? 'Unequip this item before listing it' : undefined"
        >
          <InventoryItemCell
            :user-item="userItem"
            :selected="userItem.linkId === selectedLinkId"
            :locked="disabledLinkIds.has(userItem.linkId)"
            @select="onSelect"
          />
        </div>
      </div>

      <PaginationControls
        :page="page"
        :total-pages="totalPages"
        @update:page="emit('update:page', $event)"
      />
    </template>
  </div>
</template>

<style scoped>
.item-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.item-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: var(--space-sm);
}
</style>
