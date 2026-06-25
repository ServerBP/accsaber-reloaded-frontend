<script setup lang="ts">
import { computed } from 'vue'
import SchemaNode from './SchemaNode.vue'
import { cleanValue, findMissingRequired, type JsonSchema } from './schemaUtils'

const props = defineProps<{
  schema: JsonSchema
  modelValue: Record<string, unknown> | undefined
  valueError?: string | null
}>()

const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>()

function onUpdate(value: unknown) {
  emit('update:modelValue', (value ?? {}) as Record<string, unknown>)
}

const missing = computed(() => findMissingRequired(props.schema, props.modelValue ?? {}))

const previewJson = computed(() => {
  const cleaned = cleanValue(props.modelValue ?? {})
  return cleaned === undefined ? '(empty)' : JSON.stringify(cleaned, null, 2)
})
</script>

<template>
  <div class="schema-value-form">
    <SchemaNode
      :schema="schema"
      :model-value="modelValue ?? {}"
      :depth="0"
      @update:model-value="onUpdate"
    />

    <p v-if="valueError" class="schema-value-form__error">{{ valueError }}</p>

    <ul v-if="missing.length" class="schema-value-form__missing">
      <li v-for="(m, i) in missing" :key="i">{{ m }}</li>
    </ul>

    <details class="schema-value-form__preview">
      <summary>Preview value JSON</summary>
      <pre>{{ previewJson }}</pre>
    </details>
  </div>
</template>

<style scoped>
.schema-value-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.schema-value-form__error {
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--error);
  background: color-mix(in srgb, var(--error) 10%, transparent);
  border-radius: var(--radius-input);
  color: var(--error);
  font-size: var(--text-caption);
}

.schema-value-form__missing {
  margin: 0;
  padding-left: var(--space-lg);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.schema-value-form__preview {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.schema-value-form__preview pre {
  margin: var(--space-xs) 0 0;
  padding: var(--space-sm);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  overflow: auto;
  max-height: 200px;
}
</style>
