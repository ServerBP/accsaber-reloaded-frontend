<script setup lang="ts">
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import { useCategoryStore } from '@/stores/categories'
import type { SkillCategory, SkillResponse } from '@/types/api/users'
import type { CategoryInfo } from '@/types/display'
import { computed, ref } from 'vue'

const props = defineProps<{
  skill: SkillResponse | null
  loading?: boolean
}>()

const categoryStore = useCategoryStore()

const PADDING = 44
const RADIUS = 100
const SIZE = (RADIUS + PADDING) * 2
const CENTER = SIZE / 2
const RINGS = 4
const ANGLE_OFFSET = -Math.PI / 2

const radarId = `radar-${Math.random().toString(36).slice(2, 8)}`
const hoveredIndex = ref<number | null>(null)
const pinnedIndex = ref<number | null>(null)

function infoFor(code: string): CategoryInfo | undefined {
  return (
    categoryStore.getCategoryInfo(code)
    ?? categoryStore.getCategoryInfo(code.replace(/_acc$/, ''))
  )
}

function tierFor(level: number): { label: string; color: string } {
  if (level >= 95) return { label: 'Apex', color: '#b9f2ff' }
  if (level >= 80) return { label: 'Elite', color: '#4dd9e0' }
  if (level >= 60) return { label: 'Strong', color: '#ffd700' }
  if (level >= 40) return { label: 'Solid', color: '#c0c0c0' }
  if (level >= 20) return { label: 'Casual', color: '#cd7f32' }
  return { label: 'Beginner', color: 'var(--text-tertiary)' }
}

const overall = computed<SkillCategory | null>(() => {
  if (!props.skill) return null
  return props.skill.skills.find((s) => s.categoryCode === 'overall') ?? null
})

const overallTier = computed(() =>
  overall.value ? tierFor(overall.value.skillLevel) : null,
)

const categoryEntries = computed(() => {
  if (!props.skill) return []
  return props.skill.skills
    .filter((s) => s.categoryCode !== 'overall' && s.categoryCode !== 'xp')
    .map((s) => ({ ...s, info: infoFor(s.categoryCode) }))
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
})

const radarAxes = computed(() => {
  const items = categoryEntries.value
  const count = items.length
  if (count === 0) return []
  return items.map((cat, i) => {
    const angle = ANGLE_OFFSET + (2 * Math.PI * i) / count
    const accent = cat.info?.accent ?? 'var(--accent)'
    const normalized = Math.min(Math.max(cat.skillLevel / 100, 0), 1)
    return {
      label: cat.categoryName,
      value: cat.skillLevel,
      accent,
      normalized,
      components: cat.components,
      x: CENTER + RADIUS * normalized * Math.cos(angle),
      y: CENTER + RADIUS * normalized * Math.sin(angle),
      labelX: CENTER + (RADIUS + 22) * Math.cos(angle),
      labelY: CENTER + (RADIUS + 22) * Math.sin(angle),
    }
  })
})

function polyAt(fraction: number): string {
  const count = radarAxes.value.length
  if (count === 0) return ''
  return Array.from({ length: count }, (_, i) => {
    const angle = ANGLE_OFFSET + (2 * Math.PI * i) / count
    return `${CENTER + RADIUS * fraction * Math.cos(angle)},${CENTER + RADIUS * fraction * Math.sin(angle)}`
  }).join(' ')
}

const gridRings = computed(() =>
  Array.from({ length: RINGS }, (_, i) => polyAt((i + 1) / RINGS)),
)

const spokes = computed(() => {
  const count = radarAxes.value.length
  if (count === 0) return []
  return Array.from({ length: count }, (_, i) => {
    const angle = ANGLE_OFFSET + (2 * Math.PI * i) / count
    return {
      x: CENTER + RADIUS * Math.cos(angle),
      y: CENTER + RADIUS * Math.sin(angle),
    }
  })
})

const dataPolygon = computed(() =>
  radarAxes.value.map((a) => `${a.x},${a.y}`).join(' '),
)

const gradients = computed(() =>
  radarAxes.value.map((axis, i) => ({
    id: `${radarId}-grad-${i}`,
    cx: axis.x,
    cy: axis.y,
    r: RADIUS * (0.35 + 0.65 * axis.normalized),
    color: axis.accent,
  })),
)

function textAnchor(labelX: number): string {
  if (labelX < CENTER - 2) return 'end'
  if (labelX > CENTER + 2) return 'start'
  return 'middle'
}

function formatRank(rank: number | null): string {
  if (rank == null) return '-'
  return `#${rank.toLocaleString()}`
}

function togglePin(i: number) {
  pinnedIndex.value = pinnedIndex.value === i ? null : i
}

function clearPin() {
  pinnedIndex.value = null
}

const hasNoActivity = computed(() => {
  if (!props.skill) return false
  if (props.skill.skills.length === 0) return true
  return categoryEntries.value.every((c) => c.components.categoryRank == null)
})

const activeIndex = computed(() => pinnedIndex.value ?? hoveredIndex.value)

const active = computed(() =>
  activeIndex.value != null ? radarAxes.value[activeIndex.value] : null,
)

const tooltipStyle = computed(() => {
  if (!active.value) return undefined
  const left = (active.value.x / SIZE) * 100
  const top = (active.value.y / SIZE) * 100
  const placeAbove = active.value.y > CENTER
  return {
    left: `${left}%`,
    top: `${top}%`,
    transform: placeAbove
      ? 'translate(-50%, calc(-100% - 12px))'
      : 'translate(-50%, 12px)',
  }
})
</script>

<template>
  <div class="skill-panel">
    <div v-if="loading && !skill" class="skill-panel__loading">
      <SkeletonLoader variant="stat-block" />
      <SkeletonLoader variant="card" />
    </div>

    <template v-else-if="skill">
      <div v-if="overall" class="skill-panel__headline">
        <div class="skill-panel__headline-value">{{ overall.skillLevel.toFixed(1) }}</div>
        <div
          v-if="overallTier"
          class="skill-panel__headline-tier"
          :style="{ color: overallTier.color }"
        >
          {{ overallTier.label }}
        </div>
        <div class="skill-panel__headline-label">Overall Skill Level</div>
      </div>

      <div v-if="hasNoActivity" class="skill-panel__empty">
        Play a ranked map to start your skill rating.
      </div>

      <div v-else-if="radarAxes.length >= 3" class="skill-panel__radar">
        <svg :viewBox="`0 0 ${SIZE} ${SIZE}`" class="skill-panel__svg">
          <defs>
            <clipPath :id="`${radarId}-clip`">
              <polygon :points="dataPolygon" />
            </clipPath>
            <radialGradient
              v-for="grad in gradients"
              :key="grad.id"
              :id="grad.id"
              gradientUnits="userSpaceOnUse"
              :cx="grad.cx"
              :cy="grad.cy"
              :r="grad.r"
            >
              <stop offset="0%" :stop-color="grad.color" stop-opacity="0.55" />
              <stop offset="100%" :stop-color="grad.color" stop-opacity="0" />
            </radialGradient>
          </defs>

          <polygon
            v-for="(ring, i) in gridRings"
            :key="'r' + i"
            :points="ring"
            class="skill-panel__ring"
          />

          <line
            v-for="(pt, i) in spokes"
            :key="'s' + i"
            :x1="CENTER"
            :y1="CENTER"
            :x2="pt.x"
            :y2="pt.y"
            class="skill-panel__spoke"
          />

          <g :clip-path="`url(#${radarId}-clip)`">
            <rect
              v-for="grad in gradients"
              :key="grad.id"
              x="0"
              y="0"
              :width="SIZE"
              :height="SIZE"
              :fill="`url(#${grad.id})`"
            />
          </g>

          <polygon :points="dataPolygon" class="skill-panel__data-stroke" />

          <g v-for="(axis, i) in radarAxes" :key="'l' + i">
            <text
              :x="axis.labelX"
              :y="axis.labelY - 4"
              :text-anchor="textAnchor(axis.labelX)"
              dominant-baseline="auto"
              class="skill-panel__axis-label"
            >{{ axis.label }}</text>
            <text
              :x="axis.labelX"
              :y="axis.labelY + 10"
              :text-anchor="textAnchor(axis.labelX)"
              :fill="axis.accent"
              dominant-baseline="auto"
              class="skill-panel__axis-value"
            >{{ axis.value.toFixed(1) }}</text>
          </g>

          <g
            v-for="(axis, i) in radarAxes"
            :key="'d' + i"
            class="skill-panel__dot-group"
            :class="{ 'skill-panel__dot-group--pinned': pinnedIndex === i }"
            @mouseenter="hoveredIndex = i"
            @mouseleave="hoveredIndex = null"
            @focus="hoveredIndex = i"
            @blur="hoveredIndex = null"
            @click.stop="togglePin(i)"
            @keydown.enter.prevent="togglePin(i)"
            @keydown.space.prevent="togglePin(i)"
            tabindex="0"
            role="button"
            :aria-pressed="pinnedIndex === i"
            :aria-label="`${axis.label} skill ${axis.value.toFixed(1)}`"
          >
            <circle
              :cx="axis.x"
              :cy="axis.y"
              r="12"
              fill="transparent"
              class="skill-panel__dot-hit"
            />
            <circle
              :cx="axis.x"
              :cy="axis.y"
              :r="activeIndex === i ? 5 : 3"
              :fill="axis.accent"
              class="skill-panel__dot"
            />
          </g>
        </svg>

        <div
          v-if="active"
          class="skill-panel__tooltip"
          :class="{ 'skill-panel__tooltip--pinned': pinnedIndex != null }"
          :style="{ ...tooltipStyle, '--card-accent': active.accent }"
          role="tooltip"
          @click.stop
        >
          <button
            v-if="pinnedIndex != null"
            type="button"
            class="skill-panel__tooltip-close"
            aria-label="Close breakdown"
            @click="clearPin"
          >x</button>

          <div class="skill-panel__tooltip-head">
            <div class="skill-panel__tooltip-name">{{ active.label }}</div>
          </div>
          <div class="skill-panel__tooltip-level">{{ active.value.toFixed(1) }}</div>

          <div class="skill-panel__tooltip-meta">
            <span>
              {{ formatRank(active.components.categoryRank) }}
              <span class="skill-panel__tooltip-of">of {{ active.components.activePlayers.toLocaleString() }}</span>
            </span>
          </div>

          <div class="skill-panel__bars">
            <div class="skill-panel__bar">
              <div class="skill-panel__bar-label">Rank</div>
              <div class="skill-panel__bar-track">
                <div class="skill-panel__bar-fill" :style="{ width: `${active.components.rank}%` }" />
              </div>
              <div class="skill-panel__bar-value">{{ active.components.rank.toFixed(0) }}</div>
            </div>
            <div class="skill-panel__bar">
              <div class="skill-panel__bar-label">Sustained</div>
              <div class="skill-panel__bar-track">
                <div class="skill-panel__bar-fill" :style="{ width: `${active.components.sustained}%` }" />
              </div>
              <div class="skill-panel__bar-value">{{ active.components.sustained.toFixed(0) }}</div>
            </div>
            <div class="skill-panel__bar">
              <div class="skill-panel__bar-label">Peak</div>
              <div class="skill-panel__bar-track">
                <div class="skill-panel__bar-fill" :style="{ width: `${active.components.peak}%` }" />
              </div>
              <div class="skill-panel__bar-value">{{ active.components.peak.toFixed(0) }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.skill-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  width: 100%;
  max-width: 360px;
}

.skill-panel__loading {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.skill-panel__headline {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}

.skill-panel__headline-value {
  font-family: var(--font-mono);
  font-size: 2.25rem;
  font-weight: 600;
  line-height: 1;
  color: var(--text-primary);
}

.skill-panel__headline-tier {
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.skill-panel__headline-label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.skill-panel__empty {
  padding: var(--space-lg);
  width: 100%;
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--text-body);
  border: 1px dashed var(--bg-overlay);
  border-radius: 4px;
}

.skill-panel__radar {
  position: relative;
  display: flex;
  justify-content: center;
  width: 100%;
}

.skill-panel__svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

.skill-panel__ring,
.skill-panel__spoke {
  fill: none;
  stroke: var(--bg-overlay);
  stroke-width: 0.5;
}

.skill-panel__data-stroke {
  fill: none;
  stroke: color-mix(in srgb, var(--text-primary) 30%, transparent);
  stroke-width: 1;
  stroke-linejoin: round;
}

.skill-panel__dot {
  filter: drop-shadow(0 0 3px currentColor);
  transition: r 120ms ease-out;
}

.skill-panel__dot-group {
  cursor: pointer;
  outline: none;
}

.skill-panel__dot-group:focus-visible .skill-panel__dot {
  r: 5;
}

.skill-panel__dot-hit {
  pointer-events: all;
}

.skill-panel__axis-label {
  fill: var(--text-secondary);
  font-size: 9px;
  font-family: var(--font-sans);
  font-weight: 500;
  pointer-events: none;
}

.skill-panel__axis-value {
  font-size: 9px;
  font-family: var(--font-mono);
  font-weight: 500;
  pointer-events: none;
}

.skill-panel__tooltip {
  --card-accent: var(--text-tertiary);
  position: absolute;
  z-index: 10;
  width: 280px;
  padding: var(--space-md);
  padding-top: var(--space-lg);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  pointer-events: none;
}

.skill-panel__tooltip--pinned {
  pointer-events: auto;
  border-color: var(--card-accent);
}

.skill-panel__tooltip-close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  font-family: var(--font-sans);
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
  border-radius: 2px;
  transition: color 120ms ease, background-color 120ms ease;
}

.skill-panel__tooltip-close:hover {
  color: var(--text-primary);
  background: var(--bg-overlay);
}

.skill-panel__tooltip-head {
  padding-right: 28px;
}

.skill-panel__tooltip-name {
  font-size: var(--text-caption);
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.skill-panel__tooltip-level {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 500;
  line-height: 1;
  color: var(--card-accent);
}

.skill-panel__tooltip-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  flex-wrap: wrap;
  row-gap: var(--space-xs);
}

.skill-panel__tooltip-of {
  color: var(--text-tertiary);
}

.skill-panel__bars {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-top: var(--space-xs);
}

.skill-panel__bar {
  display: grid;
  grid-template-columns: 76px 1fr 28px;
  align-items: center;
  gap: var(--space-sm);
}

.skill-panel__bar-label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.skill-panel__bar-track {
  height: 4px;
  background: var(--bg-base);
  border-radius: 2px;
  overflow: hidden;
}

.skill-panel__bar-fill {
  height: 100%;
  background: var(--card-accent);
}

.skill-panel__bar-value {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-primary);
  text-align: right;
}
</style>
