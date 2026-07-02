<script setup lang="ts">
const props = defineProps<{ modelValue: string }>()

const emit = defineEmits<{ select: [value: string] }>()

function pick(value: string) {
  emit('select', props.modelValue === value ? '' : value)
}
</script>

<template>
  <div class="label-pos" role="group" aria-label="Checkpoint label position">
    <button
      type="button"
      class="label-pos__btn label-pos__btn--up"
      :class="{ 'label-pos__btn--active': modelValue === 'UP' }"
      aria-label="Label above"
      @click="pick('UP')"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </svg>
    </button>
    <button
      type="button"
      class="label-pos__btn label-pos__btn--left"
      :class="{ 'label-pos__btn--active': modelValue === 'LEFT' }"
      aria-label="Label to the left"
      @click="pick('LEFT')"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
    </button>
    <button
      type="button"
      class="label-pos__btn label-pos__btn--none"
      :class="{ 'label-pos__btn--active label-pos__btn--hidden': modelValue === 'NONE' }"
      aria-label="Hide label"
      @click="pick('NONE')"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </svg>
    </button>
    <button
      type="button"
      class="label-pos__btn label-pos__btn--right"
      :class="{ 'label-pos__btn--active': modelValue === 'RIGHT' }"
      aria-label="Label to the right"
      @click="pick('RIGHT')"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </button>
    <button
      type="button"
      class="label-pos__btn label-pos__btn--down"
      :class="{ 'label-pos__btn--active': modelValue === 'DOWN' }"
      aria-label="Label below"
      @click="pick('DOWN')"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="5 12 12 19 19 12" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.label-pos {
  display: grid;
  grid-template-columns: repeat(3, 30px);
  grid-template-rows: repeat(3, 30px);
  gap: 3px;
  width: max-content;
}

.label-pos__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--text-secondary);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
}

.label-pos__btn:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.label-pos__btn--active {
  color: var(--page-accent, var(--accent));
  border-color: var(--page-accent, var(--accent));
  background: color-mix(in srgb, var(--page-accent, var(--accent)) 12%, transparent);
}

.label-pos__btn--hidden {
  color: var(--text-tertiary);
  border-color: var(--text-tertiary);
  background: var(--bg-elevated);
}

.label-pos__btn--up {
  grid-area: 1 / 2;
}

.label-pos__btn--left {
  grid-area: 2 / 1;
}

.label-pos__btn--none {
  grid-area: 2 / 2;
}

.label-pos__btn--right {
  grid-area: 2 / 3;
}

.label-pos__btn--down {
  grid-area: 3 / 2;
}
</style>
