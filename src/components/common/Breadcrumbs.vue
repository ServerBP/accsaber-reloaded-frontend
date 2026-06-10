<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

export interface Crumb {
  label: string
  to?: RouteLocationRaw
}

defineProps<{
  crumbs: Crumb[]
}>()
</script>

<template>
  <nav class="breadcrumbs" aria-label="Breadcrumb">
    <span class="breadcrumbs__pill">
      <template v-for="(crumb, i) in crumbs" :key="i">
        <router-link
          v-if="crumb.to"
          :to="crumb.to"
          class="breadcrumbs__crumb breadcrumbs__crumb--link"
        >{{ crumb.label }}</router-link>
        <span v-else class="breadcrumbs__crumb">{{ crumb.label }}</span>
        <span v-if="i < crumbs.length - 1" class="breadcrumbs__sep" aria-hidden="true">/</span>
      </template>
    </span>
  </nav>
</template>

<style scoped>
.breadcrumbs {
  display: flex;
  align-items: center;
}

.breadcrumbs__pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-pill);
}

.breadcrumbs__crumb {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.breadcrumbs__crumb--link {
  color: var(--text-secondary);
  transition: color 120ms ease;
}

.breadcrumbs__crumb--link:hover {
  color: var(--page-accent);
}

.breadcrumbs__sep {
  color: var(--text-tertiary);
}
</style>
