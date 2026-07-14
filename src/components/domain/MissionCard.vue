<script setup lang="ts">
import MissionRewards from '@/components/domain/MissionRewards.vue'
import { useCategoryStore } from '@/stores/categories'
import type { MissionResponse } from '@/types/api/missions'
import { buildMapRoute } from '@/utils/mapRoute'
import { BAND_LABEL, normalizeDifficulties } from '@/utils/missions'
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; to: RouteLocationRaw }

interface MissionMapLink {
  mapId: string
  beatsaverCode: string | null
  difficulty: string
  characteristic: string
}

const props = defineProps<{
  mission: MissionResponse
  mapLink?: MissionMapLink | null
}>()

const emit = defineEmits<{
  navigate: []
}>()

const categoryStore = useCategoryStore()

const isCompleted = computed(() => props.mission.status === 'completed')

const categoryInfo = computed(() =>
  props.mission.categoryCode ? categoryStore.getCategoryInfo(props.mission.categoryCode) : undefined,
)

const categoryName = computed(() => categoryInfo.value?.name ?? props.mission.categoryCode ?? '')
const categoryColor = computed(() => categoryInfo.value?.accent ?? 'var(--accent)')

const progress = computed(() => props.mission.progressCount ?? 0)

const target = computed(() => {
  switch (props.mission.type) {
    case 'PLAY_N_MAPS':
    case 'STREAK_N_IN_CATEGORY':
      return props.mission.targetCount ?? 0
    case 'XP_IN_WINDOW':
      return props.mission.targetXp ?? 0
    case 'PB_ABOVE_THRESHOLD':
      return props.mission.targetCount ?? 1
    default:
      return 0
  }
})

const hasBar = computed(() =>
  props.mission.type === 'PLAY_N_MAPS' ||
  props.mission.type === 'XP_IN_WINDOW' ||
  props.mission.type === 'PB_ABOVE_THRESHOLD' ||
  props.mission.type === 'STREAK_N_IN_CATEGORY',
)

const fillPercent = computed(() => {
  if (!hasBar.value || target.value <= 0) return 0
  const ratio = Math.min(1, progress.value / target.value)
  return Math.round(ratio * 100)
})

const counterLabel = computed(() => {
  const t = target.value
  const p = progress.value
  switch (props.mission.type) {
    case 'PLAY_N_MAPS':
      return `${p} / ${t} maps`
    case 'XP_IN_WINDOW':
      return `${p.toLocaleString()} / ${t.toLocaleString()} XP`
    case 'PB_ABOVE_THRESHOLD':
      return `${p} / ${t} PBs`
    case 'STREAK_N_IN_CATEGORY':
      return `${p} / ${t} plays`
    default:
      return ''
  }
})

const binaryHint = computed(() => {
  const m = props.mission
  switch (m.type) {
    case 'ACC_ON_MAP':
      return m.targetAcc != null ? `Reach ${m.targetAcc.toFixed(2)}% acc` : ''
    case 'AP_ON_MAP':
      return m.targetAp != null ? `Score ${m.targetAp.toLocaleString()} AP` : ''
    case 'PB_SPECIFIC_MAP':
      return 'Set a new PB'
    case 'SNIPE_PLAYER_ON_MAP': {
      const parts: string[] = []
      if (m.targetAcc != null) parts.push(`${m.targetAcc.toFixed(2)}% acc`)
      if (m.targetAp != null) parts.push(`${m.targetAp.toLocaleString()} AP`)
      return parts.length > 0 ? `Beat ${parts.join(' · ')}` : 'Beat their score'
    }
    default:
      return ''
  }
})

function inlineLink(
  segments: Segment[],
  name: string | null | undefined,
  to: RouteLocationRaw | null,
): Segment[] {
  if (!name || !to) return segments
  const out: Segment[] = []
  let replaced = false
  for (const seg of segments) {
    if (replaced || seg.kind !== 'text') {
      out.push(seg)
      continue
    }
    const idx = seg.text.indexOf(name)
    if (idx === -1) {
      out.push(seg)
      continue
    }
    if (idx > 0) out.push({ kind: 'text', text: seg.text.slice(0, idx) })
    out.push({ kind: 'link', text: name, to })
    const tail = seg.text.slice(idx + name.length)
    if (tail) out.push({ kind: 'text', text: tail })
    replaced = true
  }
  return out
}

const segments = computed<Segment[]>(() => {
  const m = props.mission
  let out: Segment[] = [{ kind: 'text', text: normalizeDifficulties(m.description) }]
  out = inlineLink(
    out,
    m.targetPlayerName,
    m.targetPlayerId ? { name: 'player-profile', params: { userId: m.targetPlayerId } } : null,
  )
  const mapTo: RouteLocationRaw | null =
    m.targetMapDifficultyId && props.mapLink
      ? buildMapRoute({
        beatsaverCode: props.mapLink.beatsaverCode,
        mapId: props.mapLink.mapId,
        difficulty: props.mapLink.difficulty,
        difficultyId: m.targetMapDifficultyId,
        characteristic: props.mapLink.characteristic,
      })
      : null
  out = inlineLink(out, m.targetMapSongName, mapTo)
  return out
})

function handleLinkClick() {
  emit('navigate')
}
</script>

<template>
  <article
    class="mission-row"
    :class="[
      mission.band ? `mission-row--${mission.band}` : null,
      { 'mission-row--done': isCompleted },
    ]"
  >
    <header class="mission-row__head">
      <h3 class="mission-row__title">
        <span class="mission-row__name">{{ mission.name }}</span>
        <span v-if="categoryName" class="mission-row__sep">·</span>
        <span v-if="categoryName" class="mission-row__cat" :style="{ color: categoryColor }">
          {{ categoryName }}
        </span>
        <span
          v-if="mission.band"
          class="mission-row__band"
          :class="`mission-row__band--${mission.band}`"
          :style="mission.band === 'hard' ? { color: categoryColor, borderColor: categoryColor } : undefined"
        >{{ BAND_LABEL[mission.band] }}</span>
      </h3>
      <MissionRewards :xp-reward="mission.xpReward" :item-reward="mission.itemReward" :size="28" />
    </header>

    <p class="mission-row__desc">
      <template v-for="(seg, i) in segments" :key="i">
        <router-link
          v-if="seg.kind === 'link'"
          :to="seg.to"
          class="mission-row__link"
          @click="handleLinkClick"
        >{{ seg.text }}</router-link>
        <template v-else>{{ seg.text }}</template>
      </template>
    </p>

    <div class="mission-row__status">
      <template v-if="isCompleted">
        <span class="mission-row__done">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Completed
        </span>
      </template>
      <template v-else-if="hasBar">
        <div class="mission-row__bar" role="progressbar"
          :aria-valuenow="progress" :aria-valuemin="0" :aria-valuemax="target">
          <div class="mission-row__bar-fill" :style="{ transform: `scaleX(${fillPercent / 100})` }" />
        </div>
        <span class="mission-row__counter">{{ counterLabel }}</span>
      </template>
      <template v-else>
        <span class="mission-row__hint">{{ binaryHint }}</span>
      </template>
    </div>
  </article>
</template>

<style scoped>
.mission-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--space-sm) var(--space-md);
  position: relative;
}

.mission-row + .mission-row {
  border-top: 1px solid var(--bg-overlay);
}

.mission-row--done .mission-row__name {
  color: var(--text-secondary);
}

.mission-row--extreme {
  --mission-reward-accent: var(--tier-gold);
}

.mission-row__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.mission-row__title {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-primary);
}

.mission-row__cat {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  flex-shrink: 0;
}

.mission-row__sep {
  color: var(--text-tertiary);
  font-weight: 400;
}

.mission-row__name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.mission-row__band {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  font-family: var(--font-sans);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  border-radius: 2px;
  border: 1px solid;
  flex-shrink: 0;
}

.mission-row__band--easy {
  color: var(--text-tertiary);
  border-color: color-mix(in srgb, var(--text-tertiary) 60%, transparent);
}

.mission-row__band--medium {
  color: var(--text-secondary);
  border-color: color-mix(in srgb, var(--text-secondary) 50%, transparent);
}

.mission-row__band--hard {
  background: color-mix(in srgb, currentColor 12%, transparent);
}

.mission-row__band--extreme {
  color: var(--tier-gold);
  border-color: color-mix(in srgb, var(--tier-gold) 70%, transparent);
  background: color-mix(in srgb, var(--tier-gold) 14%, transparent);
}

.mission-row__desc {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-secondary);
  line-height: 1.5;
}

.mission-row__link {
  color: var(--text-primary);
  font-weight: 500;
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
  transition: color 120ms ease, border-color 120ms ease;
}

.mission-row__link:hover {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.mission-row__status {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-height: 4px;
}

.mission-row__bar {
  flex: 1;
  height: 4px;
  background: var(--bg-overlay);
  border-radius: 2px;
  overflow: hidden;
}

.mission-row__bar-fill {
  width: 100%;
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transform-origin: left center;
  transition: transform 320ms cubic-bezier(0.25, 1, 0.5, 1);
  will-change: transform;
}

.mission-row__counter {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.mission-row__hint {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--text-secondary);
}

.mission-row__done {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--success);
}

@media (prefers-reduced-motion: reduce) {
  .mission-row__bar-fill {
    transition: none;
  }
}
</style>
