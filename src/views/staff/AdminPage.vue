<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'

const route = useRoute()

type AdminTab = 'users' | 'duplicates' | 'staff' | 'milestones' | 'campaigns' | 'curves' | 'news' | 'events' | 'broadcast' | 'operations' | 'items'

const VALID_TABS: AdminTab[] = ['users', 'duplicates', 'staff', 'milestones', 'campaigns', 'curves', 'news', 'events', 'broadcast', 'operations', 'items']

const activeTab = computed<AdminTab>(() => {
  const t = route.query.tab as string
  return (VALID_TABS.includes(t as AdminTab) ? t : 'users') as AdminTab
})

const tabComponents: Record<AdminTab, ReturnType<typeof defineAsyncComponent>> = {
  users: defineAsyncComponent(() => import('./admin/AdminUsersTab.vue')),
  duplicates: defineAsyncComponent(() => import('./admin/AdminDuplicatesTab.vue')),
  staff: defineAsyncComponent(() => import('./admin/AdminStaffTab.vue')),
  milestones: defineAsyncComponent(() => import('./admin/AdminMilestonesTab.vue')),
  campaigns: defineAsyncComponent(() => import('./admin/AdminCampaignsTab.vue')),
  curves: defineAsyncComponent(() => import('./admin/AdminCurvesTab.vue')),
  news: defineAsyncComponent(() => import('./admin/AdminNewsTab.vue')),
  events: defineAsyncComponent(() => import('./admin/AdminEventsTab.vue')),
  broadcast: defineAsyncComponent(() => import('./admin/AdminBroadcastTab.vue')),
  operations: defineAsyncComponent(() => import('./admin/AdminOperationsTab.vue')),
  items: defineAsyncComponent(() => import('./admin/AdminItemsTab.vue')),
}

const activeComponent = computed(() => tabComponents[activeTab.value])
</script>

<template>
  <div class="admin-page">
    <Suspense>
      <component :is="activeComponent" :key="activeTab" />
      <template #fallback>
        <div class="admin-loading">
          <SkeletonLoader variant="table-row" v-for="i in 6" :key="i" style="margin-bottom: 8px" />
        </div>
      </template>
    </Suspense>
  </div>
</template>

<style scoped>
.admin-page {
  min-height: 100vh;
  padding: var(--space-xl);
}

.admin-loading {
  padding: var(--space-xl);
}
</style>
