<script setup lang="ts" generic="T extends string">
import LeaderboardPickerIcon from './LeaderboardPickerIcon.vue'

interface PickerOption {
  key: T
  label: string
  icon: string
  description: string
}

defineProps<{ modelValue: T; options: PickerOption[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<template>
  <div class="lb-picker">
    <button v-for="opt in options" :key="opt.key" class="lb-picker__card"
      :class="{ 'lb-picker__card--active': modelValue === opt.key }" @click="emit('update:modelValue', opt.key)">
      <span class="lb-picker__icon">
        <LeaderboardPickerIcon :icon="opt.icon" />
      </span>
      <span class="lb-picker__label">{{ opt.label }}</span>
      <span class="lb-picker__desc">{{ opt.description }}</span>
    </button>
  </div>
</template>

<style scoped>
.lb-picker {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-sm);
  max-width: 760px;
  margin-inline: auto;
}

.lb-picker__card {
  flex: 0 0 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-sm);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 6px;
  cursor: pointer;
  text-align: center;
  transition: all 150ms ease;
}

.lb-picker__card:hover {
  border-color: var(--text-tertiary);
  background: var(--bg-elevated);
}

.lb-picker__card--active {
  border-color: color-mix(in srgb, var(--page-accent) 60%, transparent);
  background: color-mix(in srgb, var(--page-accent) 6%, var(--bg-surface));
}

.lb-picker__card--active:hover {
  border-color: var(--page-accent);
}

.lb-picker__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--bg-overlay);
  background: var(--bg-base);
  color: var(--text-tertiary);
  transition: all 150ms ease;
}

.lb-picker__card:hover .lb-picker__icon {
  color: var(--text-secondary);
  border-color: var(--text-tertiary);
}

.lb-picker__card--active .lb-picker__icon {
  color: var(--page-accent);
  border-color: var(--page-accent);
}

.lb-picker__label {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}

.lb-picker__desc {
  font-size: 0.625rem;
  color: var(--text-tertiary);
  line-height: 1.3;
}
</style>
