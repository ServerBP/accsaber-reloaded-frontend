<script setup lang="ts">
import { useFloatingPanel } from '@/composables/useFloatingPanel'
import type { ItemModifierRef, ItemModifierResponse } from '@/types/api/items'
import { computed } from 'vue'

const props = defineProps<{
  modelValue: ItemModifierRef[]
  modifiers: ItemModifierResponse[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: ItemModifierRef[]] }>()

const { isOpen, containerRef, triggerRef, panelRef, panelStyle, toggle } = useFloatingPanel({ minWidth: 200 })

const label = computed(() => {
  const n = props.modelValue.length
  if (n === 0) return 'No modifiers'
  if (n === 1) return props.modelValue[0].name
  return `${n} modifiers`
})

function isOn(id: string): boolean {
  return props.modelValue.some((m) => m.id === id)
}

function toggleModifier(m: ItemModifierResponse) {
  const next = isOn(m.id)
    ? props.modelValue.filter((x) => x.id !== m.id)
    : [...props.modelValue, m]
  emit('update:modelValue', next)
}
</script>

<template>
  <div ref="containerRef" class="mod-picker">
    <button
      ref="triggerRef"
      type="button"
      class="mod-picker__trigger"
      :class="{ 'mod-picker__trigger--filled': modelValue.length }"
      @click="toggle"
    >
      <span class="mod-picker__label">{{ label }}</span>
      <svg class="mod-picker__chevron" :class="{ 'mod-picker__chevron--open': isOpen }" width="12" height="12"
        viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
          stroke-linejoin="round" />
      </svg>
    </button>

    <Teleport to="body">
      <div v-if="isOpen" ref="panelRef" class="mod-picker__panel" :style="panelStyle">
        <div v-if="!modifiers.length" class="mod-picker__empty">No modifiers available</div>
        <button
          v-for="m in modifiers"
          :key="m.id"
          type="button"
          class="mod-picker__option"
          :class="{ 'mod-picker__option--on': isOn(m.id) }"
          @click="toggleModifier(m)"
        >
          <span class="mod-picker__check" aria-hidden="true">
            <svg v-if="isOn(m.id)" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </span>
          <span class="mod-picker__name">{{ m.name }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.mod-picker {
  position: relative;
}

.mod-picker__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  width: 100%;
  min-width: 160px;
  padding: 5px var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  cursor: pointer;
  text-align: left;
  transition: border-color 120ms ease, color 120ms ease;
}

.mod-picker__trigger:hover {
  border-color: var(--text-tertiary);
}

.mod-picker__trigger--filled {
  color: var(--text-primary);
}

.mod-picker__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mod-picker__chevron {
  color: var(--text-secondary);
  transition: transform 150ms ease;
  flex-shrink: 0;
}

.mod-picker__chevron--open {
  transform: rotate(180deg);
}
</style>

<style>
.mod-picker__panel {
  z-index: 1000;
  max-height: 320px;
  overflow-y: auto;
  background: var(--bg-elevated);
  border: 1px solid var(--text-tertiary);
  border-radius: var(--radius-card);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  padding: var(--space-xs);
}

.mod-picker__empty {
  padding: var(--space-md);
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--text-caption);
}

.mod-picker__option {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: 6px var(--space-sm);
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  cursor: pointer;
  text-align: left;
  border-radius: var(--radius-btn);
}

.mod-picker__option:hover {
  background: var(--bg-surface);
}

.mod-picker__check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  color: var(--accent);
}

.mod-picker__option--on .mod-picker__check {
  border-color: var(--accent);
}

.mod-picker__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
