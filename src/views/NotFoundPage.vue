<script setup lang="ts">
import { usePageMeta } from '@/composables/usePageMeta'

usePageMeta({
  title: 'Page Not Found | AccSaber',
  description: 'The page you are looking for does not exist.',
})
</script>

<template>
  <div class="page">
    <h1>404 - Page Not Found</h1>
    <p>The page you're looking for doesn't exist.</p>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: var(--space-md);
}

h1 {
  font-size: var(--text-page-title);
  font-weight: 700;
}

p {
  color: var(--text-secondary);
}
</style>
