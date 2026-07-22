<script setup lang="ts">
export interface EffectOption {
  id: string
  key: string
  label: string
}

export interface EffectCrateGroup {
  crateId: string
  crateName: string
  crateIconUrl: string | null
  effects: EffectOption[]
}

const props = defineProps<{
  groups: EffectCrateGroup[]
  ungrouped: EffectOption[]
  selected: string[]
}>()

const emit = defineEmits<{
  toggle: [key: string]
}>()

function selectedCount(group: EffectCrateGroup): number {
  return group.effects.filter((e) => props.selected.includes(e.key)).length
}
</script>

<template>
  <div class="effect-filter">
    <details v-for="group in groups" :key="group.crateId" class="effect-filter__group">
      <summary class="effect-filter__summary">
        <svg
          class="effect-filter__caret"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <img
          v-if="group.crateIconUrl"
          class="effect-filter__crate-icon"
          :src="group.crateIconUrl"
          alt=""
          loading="lazy"
          decoding="async"
        />
        <span class="effect-filter__crate-name">{{ group.crateName }}</span>
        <span class="effect-filter__count">{{ group.effects.length }}</span>
        <span v-if="selectedCount(group) > 0" class="effect-filter__selected">
          {{ selectedCount(group) }} selected
        </span>
      </summary>
      <div class="effect-filter__list">
        <label
          v-for="effect in group.effects"
          :key="`${group.crateId}:${effect.id}`"
          class="effect-filter__option"
        >
          <input
            type="checkbox"
            :checked="selected.includes(effect.key)"
            @change="emit('toggle', effect.key)"
          />
          <span class="effect-filter__label">
            <span class="effect-filter__star" aria-hidden="true">★</span>
            {{ effect.label }}
          </span>
        </label>
      </div>
    </details>

    <div v-if="ungrouped.length > 0" class="effect-filter__list effect-filter__list--ungrouped">
      <label v-for="effect in ungrouped" :key="effect.id" class="effect-filter__option">
        <input
          type="checkbox"
          :checked="selected.includes(effect.key)"
          @change="emit('toggle', effect.key)"
        />
        <span class="effect-filter__label">
          <span class="effect-filter__star" aria-hidden="true">★</span>
          {{ effect.label }}
        </span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.effect-filter {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.effect-filter__group {
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  background: var(--bg-base);
}

.effect-filter__summary {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  cursor: pointer;
  list-style: none;
  font-size: var(--text-body);
  color: var(--text-primary);
  user-select: none;
}

.effect-filter__summary::-webkit-details-marker {
  display: none;
}

.effect-filter__summary:hover {
  color: var(--page-accent, var(--accent));
}

.effect-filter__caret {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--text-tertiary);
  transition: transform 120ms ease;
}

.effect-filter__group[open] .effect-filter__caret {
  transform: rotate(90deg);
}

.effect-filter__crate-icon {
  width: 18px;
  height: 18px;
  border-radius: var(--radius-btn);
  object-fit: contain;
  flex-shrink: 0;
}

.effect-filter__crate-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.effect-filter__count {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.effect-filter__selected {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--page-accent, var(--accent));
  white-space: nowrap;
}

.effect-filter__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm) var(--space-sm) var(--space-lg);
}

.effect-filter__list--ungrouped {
  padding: 0;
}

.effect-filter__option {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
  font-size: var(--text-body);
}

.effect-filter__option input {
  accent-color: var(--page-accent, var(--accent));
}

.effect-filter__label {
  color: var(--text-primary);
}

.effect-filter__star {
  color: var(--tier-gold);
  font-size: 0.75em;
}

@media (prefers-reduced-motion: reduce) {
  .effect-filter__caret {
    transition: none;
  }
}
</style>
