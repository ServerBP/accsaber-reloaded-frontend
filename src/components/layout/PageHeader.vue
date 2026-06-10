<script setup lang="ts">
interface Breadcrumb {
  label: string
  to?: string
}

defineProps<{
  title: string
  breadcrumbs?: Breadcrumb[]
}>()
</script>

<template>
  <header class="page-header">
    <nav v-if="breadcrumbs?.length" class="page-header__breadcrumbs" aria-label="Breadcrumb">
      <template v-for="(crumb, i) in breadcrumbs" :key="i">
        <router-link v-if="crumb.to" class="page-header__crumb page-header__crumb--link" :to="crumb.to">
          {{ crumb.label }}
        </router-link>
        <span v-else class="page-header__crumb">{{ crumb.label }}</span>
        <span v-if="i < breadcrumbs.length - 1" class="page-header__separator">/</span>
      </template>
    </nav>
    <div class="page-header__row">
      <h1 class="page-header__title">{{ title }}</h1>
      <div v-if="$slots.actions" class="page-header__actions">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<style scoped>
.page-header {
  position: relative;
  padding-bottom: var(--space-lg);
  margin-bottom: var(--space-lg);
  border-bottom: 1px solid var(--bg-overlay);
}

.page-header__breadcrumbs {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
}

.page-header__crumb {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.page-header__crumb--link {
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 120ms ease;
}

.page-header__crumb--link:hover {
  color: var(--accent);
}

.page-header__separator {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.page-header__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

.page-header__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.page-header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
</style>
