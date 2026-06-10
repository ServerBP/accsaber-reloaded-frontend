<script setup lang="ts" generic="T extends string | number | boolean">
interface PickerOption {
  value: T
  label: string
  description?: string
}

defineProps<{
  modelValue: T | null
  options: PickerOption[]
  ariaLabel: string
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<template>
  <div class="settings-picker" role="radiogroup" :aria-label="ariaLabel">
    <button v-for="opt in options" :key="String(opt.value)" type="button" class="settings-picker__btn"
      :class="{ 'settings-picker__btn--active': modelValue === opt.value }" role="radio"
      :aria-checked="modelValue === opt.value" :title="opt.description" :disabled="disabled"
      @click="emit('update:modelValue', opt.value)">
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.settings-picker {
  display: inline-flex;
  padding: 3px;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  gap: 2px;
}

.settings-picker__btn {
  padding: var(--space-xs) var(--space-md);
  background: transparent;
  border: none;
  border-radius: 3px;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 500;
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease;
}

.settings-picker__btn:hover:not(:disabled) {
  color: var(--text-primary);
}

.settings-picker__btn--active {
  color: var(--page-accent);
  background: color-mix(in srgb, var(--page-accent) 10%, var(--bg-surface));
}

.settings-picker__btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
