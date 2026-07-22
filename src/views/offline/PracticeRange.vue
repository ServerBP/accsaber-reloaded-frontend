<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import { useElementCanvas } from '@/composables/useBackdropCanvas'
import type { PracticeScoreSubmission } from '@/types/api/practiceScores'
import { addLocalScore, loadLastName, loadLocalScores, saveLastName } from '@/utils/practiceScores'
import { computed, ref } from 'vue'
import { createPracticeRange, type GameSnapshot, type GameState, type RangeMode } from './practiceRange'

const canvasRef = ref<HTMLCanvasElement | null>(null)

const mode = ref<RangeMode>('zen')
const gameState = ref<GameState>('idle')

const zenCuts = ref(0)
const zenBad = ref(0)
const zenSum = ref(0)

const snap = ref<GameSnapshot>({ lives: 3, level: 1, score: 0, badCuts: 0, bombHits: 0, accuracy: 100 })
const finalSnap = ref<GameSnapshot | null>(null)

const playerName = ref(loadLastName())
const saved = ref(false)
const savedAt = ref('')
const topScores = ref<PracticeScoreSubmission[]>(loadLocalScores())

const scene = createPracticeRange((ev) => {
  if (ev.type === 'cut') {
    if (ev.good) {
      zenCuts.value += 1
      zenSum.value += ev.score
    } else {
      zenBad.value += 1
    }
  } else if (ev.type === 'game') {
    snap.value = ev.snapshot
  } else {
    snap.value = ev.snapshot
    finalSnap.value = ev.snapshot
    gameState.value = 'over'
    saved.value = false
  }
})

useElementCanvas(canvasRef, scene)

const zenSliced = computed(() => zenCuts.value + zenBad.value > 0)
const zenAvg = computed(() => (zenCuts.value > 0 ? (zenSum.value / zenCuts.value).toFixed(1) : null))
const zenAcc = computed(() => {
  const notes = zenCuts.value + zenBad.value
  return notes > 0 ? ((zenSum.value / (115 * notes)) * 100).toFixed(1) : null
})
const hint =
  window.matchMedia('(pointer: coarse)').matches
    ? 'Swipe through a bloq'
    : 'Swing your cursor through a bloq'

const localBest = computed(() => topScores.value[0] ?? null)
const top10 = computed(() => topScores.value.slice(0, 10))
const canSave = computed(() => {
  const name = playerName.value.trim()
  return name.length > 0 && name.length <= 24
})
const finalLine = computed(() => {
  const s = finalSnap.value
  if (!s) return ''
  return `score ${s.score.toLocaleString()} · level ${s.level} · acc ${s.accuracy.toFixed(1)}%`
})

function setMode(next: RangeMode) {
  if (mode.value === next) return
  mode.value = next
  gameState.value = 'idle'
  scene.setMode(next)
}

function startGame() {
  snap.value = { lives: 3, level: 1, score: 0, badCuts: 0, bombHits: 0, accuracy: 100 }
  finalSnap.value = null
  saved.value = false
  gameState.value = 'playing'
  scene.start()
}

function saveScore() {
  const s = finalSnap.value
  if (!s || !canSave.value || saved.value) return
  const name = playerName.value.trim()
  saveLastName(name)
  const entry: PracticeScoreSubmission = {
    id: crypto.randomUUID(),
    name,
    score: s.score,
    level: s.level,
    accuracy: Math.round(s.accuracy * 10) / 10,
    badCuts: s.badCuts,
    bombHits: s.bombHits,
    playedAt: new Date().toISOString(),
  }
  topScores.value = addLocalScore(entry)
  savedAt.value = entry.playedAt
  saved.value = true
}

function onPointer(e: PointerEvent) {
  const el = canvasRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  scene.pointerMove(e.clientX - rect.left, e.clientY - rect.top, performance.now())
}
</script>

<template>
  <section class="range" aria-label="Practice range">
    <header class="range__bar">
      <div class="range__modes" role="tablist" aria-label="Range mode">
        <button
          class="range__mode"
          :class="{ 'range__mode--active': mode === 'zen' }"
          role="tab"
          :aria-selected="mode === 'zen'"
          @click="setMode('zen')"
        >
          Zen
        </button>
        <button
          class="range__mode"
          :class="{ 'range__mode--active': mode === 'game' }"
          role="tab"
          :aria-selected="mode === 'game'"
          @click="setMode('game')"
        >
          Minigame
        </button>
      </div>
      <span v-if="mode === 'zen' && zenSliced" class="range__stats">
        {{ zenCuts }} cuts<template v-if="zenBad"> · {{ zenBad }} bad</template
        ><template v-if="zenAvg"> · avg {{ zenAvg }}</template
        ><template v-if="zenAcc"> · acc {{ zenAcc }}%</template
        ><template v-if="zenSum"> · score {{ zenSum.toLocaleString() }}</template>
      </span>
      <span v-else-if="mode === 'game' && gameState !== 'idle'" class="range__hud">
        <span class="range__lives" aria-label="Lives">
          <svg
            v-for="i in 3"
            :key="i"
            class="range__heart"
            :class="{ 'range__heart--lost': i > snap.lives }"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M12 21C7 16.5 4 13.5 4 10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 3.5-3 6.5-8 11z"
            />
          </svg>
        </span>
        LV {{ snap.level }} · {{ snap.score.toLocaleString() }} · {{ snap.accuracy.toFixed(1) }}%
      </span>
    </header>
    <div class="range__stage">
      <canvas
        ref="canvasRef"
        class="range__canvas"
        @pointerdown="onPointer"
        @pointermove="onPointer"
        @pointerleave="scene.pointerEnd()"
      />
      <p v-if="mode === 'zen' && !zenSliced" class="range__hint" aria-hidden="true">{{ hint }}</p>
      <div v-if="mode === 'game' && gameState === 'idle'" class="range__overlay">
        <p class="range__overlay-title">Three lives. Don't let a bloq slip past.</p>
        <p class="range__overlay-line">
          Wrong-direction cuts and bombs cost a life, hearts give one back. It gets faster.
        </p>
        <p v-if="localBest" class="range__overlay-note">
          Local best: {{ localBest.score.toLocaleString() }} by {{ localBest.name }}
        </p>
        <BaseButton size="sm" variant="primary" @click="startGame">Start</BaseButton>
      </div>
      <div v-else-if="mode === 'game' && gameState === 'over'" class="range__overlay">
        <p class="range__overlay-title">Game over</p>
        <p class="range__overlay-line">{{ finalLine }}</p>
        <form v-if="!saved" class="range__save" @submit.prevent="saveScore">
          <BaseInput v-model="playerName" placeholder="Your name" maxlength="24" aria-label="Your name" />
          <BaseButton size="sm" variant="primary" :disabled="!canSave">Save score</BaseButton>
        </form>
        <ol v-else class="range__board">
          <li
            v-for="(row, i) in top10"
            :key="row.playedAt + row.name"
            class="range__board-row"
            :class="{ 'range__board-row--own': row.playedAt === savedAt }"
          >
            <span class="range__board-rank">{{ i + 1 }}</span>
            <span class="range__board-name">{{ row.name }}</span>
            <span class="range__board-score">{{ row.score.toLocaleString() }}</span>
          </li>
        </ol>
        <BaseButton size="sm" @click="startGame">Play again</BaseButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.range {
  border: 1px solid var(--bg-overlay);
  border-radius: 6px;
  background: var(--bg-surface);
  overflow: hidden;
}

.range__bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--bg-overlay);
}

.range__modes {
  display: flex;
  gap: var(--space-md);
}

.range__mode {
  background: none;
  border: none;
  padding: 2px 0;
  cursor: pointer;
  font-size: var(--text-caption);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  border-bottom: 2px solid transparent;
}

.range__mode--active {
  color: var(--text-primary);
  border-bottom-color: var(--page-accent, var(--accent));
}

.range__stats,
.range__hud {
  font-family: var(--font-mono);
  font-size: var(--text-body);
  color: var(--text-primary);
  white-space: nowrap;
}

.range__hud {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
}

.range__lives {
  display: inline-flex;
  gap: 3px;
}

.range__heart {
  width: 14px;
  height: 14px;
  fill: var(--success);
}

.range__heart--lost {
  fill: none;
  stroke: var(--text-tertiary);
  stroke-width: 2;
}

.range__stage {
  position: relative;
}

.range__canvas {
  display: block;
  width: 100%;
  height: clamp(240px, 36vh, 330px);
  cursor: crosshair;
  touch-action: none;
}

.range__hint {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.range__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  text-align: center;
  background: color-mix(in srgb, var(--bg-surface) 84%, transparent);
}

.range__overlay-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.range__overlay-line {
  font-size: var(--text-body);
  color: var(--text-secondary);
}

.range__overlay-note {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.range__save {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.range__board {
  list-style: none;
  width: min(320px, 100%);
  max-height: 150px;
  overflow-y: auto;
  font-size: var(--text-caption);
}

.range__board-row {
  display: grid;
  grid-template-columns: 24px 1fr auto;
  gap: var(--space-sm);
  padding: 2px 0;
  color: var(--text-secondary);
}

.range__board-row--own {
  color: var(--text-primary);
  font-weight: 600;
}

.range__board-rank {
  text-align: right;
  color: var(--text-tertiary);
}

.range__board-name {
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.range__board-score {
  font-family: var(--font-mono);
}
</style>
