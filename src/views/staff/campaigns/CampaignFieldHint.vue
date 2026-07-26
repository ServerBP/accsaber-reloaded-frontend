<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <span
    v-if="text"
    class="field-hint"
    role="img"
    :aria-label="text"
    :title="text"
    @click.prevent.stop
  >
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.7 9.2a2.4 2.4 0 0 1 4.6.8c0 1.6-2.3 2.3-2.3 2.3" />
      <line x1="12" y1="16.4" x2="12" y2="16.41" />
    </svg>
  </span>
</template>

<style scoped>
.field-hint {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--text-tertiary);
  cursor: help;
  transition: color 120ms ease;
}

.field-hint:hover {
  color: var(--page-accent);
}
</style>
