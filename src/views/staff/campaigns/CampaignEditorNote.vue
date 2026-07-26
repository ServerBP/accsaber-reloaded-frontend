<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'warning' | 'error' }>(), { tone: 'warning' })
</script>

<template>
  <p class="editor-note" :class="`editor-note--${tone}`" :role="tone === 'error' ? 'alert' : undefined">
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path
        d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
      />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12" y2="17.01" />
    </svg>
    <span><slot /></span>
  </p>
</template>

<style scoped>
.editor-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  padding: 7px 9px;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  line-height: 1.45;
  border-radius: 3px;
}

.editor-note svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.editor-note--warning {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent);
}

.editor-note--error {
  color: var(--error);
  background: color-mix(in srgb, var(--error) 12%, transparent);
  border: 1px solid var(--error);
}
</style>
