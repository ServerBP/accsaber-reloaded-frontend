<script setup lang="ts">
import { computed } from 'vue'
import CountryFlag from './CountryFlag.vue'

const props = defineProps<{
  sniperName: string
  sniperCountry?: string
  sniperWins: number
  targetName: string
  targetCountry?: string
  targetWins: number
  unplayed: number
  loading?: boolean
}>()

const total = computed(() =>
  Math.max(0, props.sniperWins) + Math.max(0, props.targetWins) + Math.max(0, props.unplayed),
)

const sniperFlex = computed(() => Math.max(0, props.sniperWins))
const targetFlex = computed(() => Math.max(0, props.targetWins))
const unplayedFlex = computed(() => Math.max(0, props.unplayed))

const sniperPct = computed(() =>
  total.value > 0 ? (props.sniperWins / total.value) * 100 : 0,
)
const targetPct = computed(() =>
  total.value > 0 ? (props.targetWins / total.value) * 100 : 0,
)
const unplayedPct = computed(() =>
  total.value > 0 ? (props.unplayed / total.value) * 100 : 0,
)
</script>

<template>
  <section class="tug" aria-label="Map win standings">
    <header class="tug__header">
      <div class="tug__side tug__side--sniper">
        <span class="tug__name">
          <CountryFlag v-if="sniperCountry" :country="sniperCountry" />
          <span class="tug__name-text">{{ sniperName }}</span>
        </span>
        <span class="tug__count tug__count--sniper">
          <span class="tug__count-value">{{ loading ? '...' : sniperWins.toLocaleString() }}</span>
          <span class="tug__count-pct">{{ loading ? '' : `${sniperPct.toFixed(0)}%` }}</span>
        </span>
        <span class="tug__sub">maps ahead</span>
      </div>

      <div class="tug__middle">
        <span class="tug__unplayed-value">{{ loading ? '...' : unplayed.toLocaleString() }}</span>
        <span class="tug__unplayed-label">unplayed</span>
        <span class="tug__unplayed-pct">{{ loading ? '' : `${unplayedPct.toFixed(0)}%` }}</span>
      </div>

      <div class="tug__side tug__side--target">
        <span class="tug__name">
          <span class="tug__name-text">{{ targetName }}</span>
          <CountryFlag v-if="targetCountry" :country="targetCountry" />
        </span>
        <span class="tug__count tug__count--target">
          <span class="tug__count-value">{{ loading ? '...' : targetWins.toLocaleString() }}</span>
          <span class="tug__count-pct">{{ loading ? '' : `${targetPct.toFixed(0)}%` }}</span>
        </span>
        <span class="tug__sub">maps ahead</span>
      </div>
    </header>

    <div class="tug__rail" :class="{ 'tug__rail--loading': loading }">
      <div
        class="tug__seg tug__seg--sniper"
        :style="{ flexGrow: sniperFlex }"
        :aria-hidden="true"
      />
      <div
        class="tug__seg tug__seg--gap"
        :style="{ flexGrow: unplayedFlex }"
        :aria-hidden="true"
      />
      <div
        class="tug__seg tug__seg--target"
        :style="{ flexGrow: targetFlex }"
        :aria-hidden="true"
      />
    </div>
  </section>
</template>

<style scoped>
.tug {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.tug__header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: var(--space-lg);
  align-items: end;
}

.tug__side {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.tug__side--sniper {
  align-items: flex-start;
  text-align: left;
}

.tug__side--target {
  align-items: flex-end;
  text-align: right;
}

.tug__name {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  min-width: 0;
}

.tug__name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.tug__count {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-xs);
  font-family: var(--font-mono);
  line-height: 1;
}

.tug__count-value {
  font-size: 1.75rem;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.tug__count-pct {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  font-weight: 500;
}

.tug__count--sniper .tug__count-value {
  color: var(--text-primary);
}

.tug__count--target .tug__count-value {
  color: var(--accent);
}

.tug__sub {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.tug__middle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0 var(--space-sm);
}

.tug__unplayed-value {
  font-family: var(--font-mono);
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--text-secondary);
  line-height: 1;
}

.tug__unplayed-label {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.tug__unplayed-pct {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.tug__rail {
  position: relative;
  display: flex;
  align-items: stretch;
  width: 100%;
  height: 16px;
  border-radius: 2px;
  overflow: hidden;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  gap: 1px;
  box-shadow: inset 0 1px 2px color-mix(in srgb, var(--bg-base) 60%, transparent);
}

.tug__rail::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: color-mix(in srgb, var(--text-tertiary) 35%, transparent);
  pointer-events: none;
}

.tug__rail--loading {
  opacity: 0.5;
}

.tug__seg {
  height: 100%;
  min-width: 0;
  transition: flex-grow 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tug__seg--sniper {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--text-primary) 55%, transparent),
    var(--text-primary)
  );
}

.tug__seg--target {
  background: linear-gradient(
    90deg,
    var(--accent),
    color-mix(in srgb, var(--accent) 55%, transparent)
  );
}

.tug__seg--gap {
  background-color: transparent;
  background-image: repeating-linear-gradient(
    -45deg,
    transparent 0 3px,
    color-mix(in srgb, var(--text-tertiary) 60%, transparent) 3px 4px
  );
}

@media (max-width: 768px) {
  .tug {
    padding: var(--space-md);
  }

  .tug__header {
    gap: var(--space-md);
  }

  .tug__count-value {
    font-size: 1.375rem;
  }

  .tug__name-text {
    max-width: 100px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tug__seg {
    transition: none;
  }
}
</style>
