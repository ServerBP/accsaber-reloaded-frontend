<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'

const route = useRoute()

type CreativesTab = 'crates' | 'preview'

const VALID_TABS: CreativesTab[] = ['crates', 'preview']

const activeTab = computed<CreativesTab>(() => {
  const t = route.query.tab as string
  return (VALID_TABS.includes(t as CreativesTab) ? t : 'crates') as CreativesTab
})

const tabComponents: Record<CreativesTab, ReturnType<typeof defineAsyncComponent>> = {
  crates: defineAsyncComponent(() => import('./CreativesCratesTab.vue')),
  preview: defineAsyncComponent(() => import('./CreativesPreviewTab.vue')),
}

const activeComponent = computed(() => tabComponents[activeTab.value])
</script>

<template>
  <div class="creatives-page">
    <Suspense>
      <component :is="activeComponent" :key="activeTab" />
      <template #fallback>
        <div class="creatives-loading">
          <SkeletonLoader variant="card" v-for="i in 4" :key="i" style="margin-bottom: 12px" />
        </div>
      </template>
    </Suspense>
  </div>
</template>

<style scoped>
.creatives-page {
  min-height: 100vh;
  padding: var(--space-xl);
  max-width: 1440px;
  margin: 0 auto;
}

.creatives-loading {
  padding: var(--space-xl);
}
</style>
