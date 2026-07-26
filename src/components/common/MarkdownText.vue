<script setup lang="ts">
import { renderMarkdown } from '@/utils/markdown'
import { computed } from 'vue'

const props = defineProps<{ content: string }>()

const html = computed(() => renderMarkdown(props.content))
</script>

<template>
  <div class="markdown-text" v-html="html" />
</template>

<style scoped>
.markdown-text {
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  line-height: 1.55;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

.markdown-text :deep(> *:first-child) {
  margin-top: 0;
}

.markdown-text :deep(> *:last-child) {
  margin-bottom: 0;
}

.markdown-text :deep(p),
.markdown-text :deep(ul),
.markdown-text :deep(ol),
.markdown-text :deep(blockquote),
.markdown-text :deep(pre) {
  margin: 0 0 var(--space-sm);
}

.markdown-text :deep(h1),
.markdown-text :deep(h2),
.markdown-text :deep(h3),
.markdown-text :deep(h4),
.markdown-text :deep(h5),
.markdown-text :deep(h6) {
  margin: var(--space-sm) 0 4px;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.markdown-text :deep(strong) {
  color: var(--text-primary);
  font-weight: 600;
}

.markdown-text :deep(a) {
  color: var(--page-accent, var(--accent));
  text-decoration: underline;
  text-underline-offset: 2px;
}

.markdown-text :deep(ul),
.markdown-text :deep(ol) {
  padding-left: var(--space-md);
}

.markdown-text :deep(li) {
  margin-bottom: 2px;
}

.markdown-text :deep(blockquote) {
  padding-left: var(--space-sm);
  border-left: 1px solid var(--bg-overlay);
  color: var(--text-tertiary);
}

.markdown-text :deep(code) {
  padding: 1px 4px;
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: 2px;
}

.markdown-text :deep(pre) {
  padding: var(--space-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  overflow-x: auto;
}

.markdown-text :deep(pre code) {
  padding: 0;
  background: transparent;
  border: none;
}

.markdown-text :deep(img) {
  max-width: 100%;
  border-radius: 3px;
}

.markdown-text :deep(hr) {
  margin: var(--space-sm) 0;
  border: none;
  border-top: 1px solid var(--bg-overlay);
}
</style>
