<script setup lang="ts">
import BaseTabs from '@/components/common/BaseTabs.vue'
import { computed, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'

type ItemsSubTab = 'items' | 'types' | 'modifiers' | 'unusual' | 'award' | 'crates'
const VALID: ItemsSubTab[] = ['items', 'types', 'modifiers', 'unusual', 'award', 'crates']

const route = useRoute()
const router = useRouter()

const tabs = [
  { key: 'items', label: 'Items' },
  { key: 'types', label: 'Types' },
  { key: 'modifiers', label: 'Modifiers' },
  { key: 'unusual', label: 'Unusual FX' },
  { key: 'crates', label: 'Crates' },
  { key: 'award', label: 'Award' },
]

const subTab = computed<ItemsSubTab>(() => {
  const t = route.query.itab as string
  return (VALID.includes(t as ItemsSubTab) ? t : 'items') as ItemsSubTab
})

function setSubTab(key: string) {
  router.replace({ query: { ...route.query, itab: key } })
}

const subComponents: Record<ItemsSubTab, ReturnType<typeof defineAsyncComponent>> = {
  items: defineAsyncComponent(() => import('./items/ItemsManagementTab.vue')),
  types: defineAsyncComponent(() => import('./items/ItemTypesManagementTab.vue')),
  modifiers: defineAsyncComponent(() => import('./items/ItemModifiersListTab.vue')),
  unusual: defineAsyncComponent(() => import('./items/UnusualEffectsListTab.vue')),
  crates: defineAsyncComponent(() => import('./items/CratesListTab.vue')),
  award: defineAsyncComponent(() => import('./items/AwardItemTab.vue')),
}

const activeComponent = computed(() => subComponents[subTab.value])
</script>

<template>
  <div class="admin-items">
    <BaseTabs :tabs="tabs" :model-value="subTab" @update:model-value="setSubTab" />
    <div class="admin-items__body">
      <component :is="activeComponent" :key="subTab" />
    </div>
  </div>
</template>

<style scoped>
.admin-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.admin-items__body {
  min-height: 400px;
}
</style>
