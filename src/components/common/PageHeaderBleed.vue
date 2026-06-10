<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header class="page-header-bleed">
    <div class="page-header-bleed__content">
      <h1 class="page-header-bleed__title">{{ title }}</h1>
      <p class="page-header-bleed__subtitle">{{ subtitle ?? '\u00A0' }}</p>
    </div>
  </header>
</template>

<style scoped>
.page-header-bleed {
  position: relative;
  text-align: center;
  padding: var(--space-2xl) 0 var(--space-lg);
}

.page-header-bleed__content {
  position: relative;
}

.page-header-bleed__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.page-header-bleed__subtitle {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  margin: var(--space-xs) 0 0;
  letter-spacing: 0.02em;
  min-height: 1em;
}

@media (max-width: 767px) {
  .page-header-bleed {
    padding: var(--space-lg) 0 var(--space-md);
  }
}
</style>
