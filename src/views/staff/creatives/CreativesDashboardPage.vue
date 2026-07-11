<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'

const CreativesCratesTab = defineAsyncComponent(() => import('./CreativesCratesTab.vue'))
</script>

<template>
  <div class="creatives-page">
    <Suspense>
      <CreativesCratesTab />
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
