<script setup lang="ts">
import GlowImage from '@/components/common/GlowImage.vue'
import CategoryBadge from '@/components/domain/CategoryBadge.vue'
import ComplexityBadge from '@/components/domain/ComplexityBadge.vue'
import DifficultyBadge from '@/components/domain/DifficultyBadge.vue'
import { useCategoryStore } from '@/stores/categories'
import { useModifierStore } from '@/stores/modifiers'
import { useSettingsStore } from '@/stores/settings'
import type { ScoreResponse } from '@/types/api/users'
import { formatRelativeDate } from '@/utils/formatters'
import { buildMapRoute } from '@/utils/mapRoute'
import { getRankClass } from '@/utils/ranking'
import { resolveReplay } from '@/utils/replay'
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const COMMENT_MAX = 280

const props = defineProps<{
  score: ScoreResponse
  canUnpin: boolean
  comment?: string | null
  editable?: boolean
  complexity?: number | null
}>()

const emit = defineEmits<{
  unpin: [scoreId: string]
  'open-detail': [score: ScoreResponse]
  'save-comment': [payload: { scoreId: string, comment: string | null }]
}>()

const editing = ref(false)
const draft = ref('')
const saving = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const remaining = computed(() => COMMENT_MAX - draft.value.length)
const overLimit = computed(() => remaining.value < 0)

watch(() => props.comment, () => {
  if (!editing.value) draft.value = props.comment ?? ''
}, { immediate: true })

async function startEdit(e: MouseEvent) {
  if (!props.editable) return
  e.preventDefault()
  e.stopPropagation()
  draft.value = props.comment ?? ''
  editing.value = true
  await nextTick()
  textareaRef.value?.focus()
  const len = textareaRef.value?.value.length ?? 0
  textareaRef.value?.setSelectionRange(len, len)
}

function cancelEdit(e?: Event) {
  e?.preventDefault()
  e?.stopPropagation()
  editing.value = false
  draft.value = props.comment ?? ''
}

async function saveEdit(e?: Event) {
  e?.preventDefault()
  e?.stopPropagation()
  if (overLimit.value) return
  const trimmed = draft.value.trim()
  const next: string | null = trimmed.length === 0 ? null : trimmed
  if (next === (props.comment ?? null)) {
    editing.value = false
    return
  }
  saving.value = true
  try {
    emit('save-comment', { scoreId: props.score.id, comment: next })
    editing.value = false
  } finally {
    saving.value = false
  }
}

function onTextareaKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    cancelEdit()
  } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    saveEdit()
  }
}

const router = useRouter()
const categoryStore = useCategoryStore()
const modifierStore = useModifierStore()
const settingsStore = useSettingsStore()

const replayService = computed(() => settingsStore.appearance['appearance.primaryReplayService'])
const replay = computed(() =>
  resolveReplay(
    {
      blScoreId: props.score.blScoreId,
      ssScoreId: props.score.ssScoreId,
      date: props.score.timeSet,
    },
    replayService.value,
  ),
)

const categoryCode = computed(() => categoryStore.getCategoryCode(props.score.categoryId))
const categoryAccent = computed(() => categoryCode.value
  ? categoryStore.getAccent(categoryCode.value)
  : 'var(--accent)')

const accuracyPct = computed(() => (props.score.accuracy * 100).toFixed(2))
const apFormatted = computed(() => props.score.ap.toFixed(2))
const weightedFormatted = computed(() => props.score.weightedAp.toFixed(2))

const modifierLabels = computed(() => modifierStore.resolveModifierCodes(props.score.modifierIds))

const mapTarget = computed(() => buildMapRoute({
  beatsaverCode: props.score.beatsaverCode,
  mapId: props.score.mapId,
  difficulty: props.score.difficulty,
  difficultyId: props.score.mapDifficultyId,
  characteristic: props.score.characteristic,
}))
const mapHref = computed(() => router.resolve(mapTarget.value).href)

function navigateToMap(e: MouseEvent) {
  if (e.ctrlKey || e.metaKey || e.button === 1) return
  const target = e.target as HTMLElement | null
  if (target?.closest('.pin-card__comment, .pin-card__comment-placeholder, .pin-card__comment-edit, .pin-card__foot-btn')) {
    e.preventDefault()
    return
  }
  e.preventDefault()
  router.push(mapTarget.value)
}

function onDetailClick(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  emit('open-detail', props.score)
}

function onUnpinClick(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  emit('unpin', props.score.id)
}

function onReplayClick(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (!replay.value) return
  window.open(replay.value.url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <a :href="mapHref" class="pin-card" :style="{ '--card-accent': categoryAccent }" @click="navigateToMap">
    <div v-if="editing" class="pin-card__comment-edit" @click.stop.prevent @mousedown.stop>
      <textarea ref="textareaRef" v-model="draft" class="pin-card__comment-input"
        :maxlength="COMMENT_MAX + 50" :placeholder="`Say something about this score (max ${COMMENT_MAX} chars)`"
        rows="2" @keydown="onTextareaKeydown" />
      <div class="pin-card__comment-row">
        <span class="pin-card__comment-counter" :class="{ 'pin-card__comment-counter--over': overLimit }">
          {{ remaining }}
        </span>
        <button type="button" class="pin-card__comment-btn" :disabled="saving" @click="cancelEdit">Cancel</button>
        <button type="button" class="pin-card__comment-btn pin-card__comment-btn--primary"
          :disabled="saving || overLimit" @click="saveEdit">Save</button>
      </div>
    </div>
    <button v-else-if="comment" type="button" class="pin-card__comment"
      :class="{ 'pin-card__comment--editable': editable }"
      :tabindex="editable ? 0 : -1" :aria-label="editable ? 'Edit comment' : undefined"
      @click="startEdit">
      <span class="pin-card__comment-mark" aria-hidden="true">&ldquo;</span>{{ comment }}<span class="pin-card__comment-mark" aria-hidden="true">&rdquo;</span>
    </button>
    <button v-else-if="editable" type="button" class="pin-card__comment-placeholder" @click="startEdit">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
      </svg>
      <span>Add a comment</span>
    </button>

    <div class="pin-card__body">
      <GlowImage :src="score.cdnCoverUrl ?? score.coverUrl" :alt="score.songName" :size="88"
        class="pin-card__cover"
        :fallback-src="score.cdnCoverUrl && score.coverUrl && score.cdnCoverUrl !== score.coverUrl ? score.coverUrl : null" />
      <div class="pin-card__map">
        <CategoryBadge v-if="categoryCode" :category="categoryCode" size="sm" class="pin-card__eyebrow" />
        <h3 class="pin-card__song" :title="score.songName">{{ score.songName }}</h3>
        <div class="pin-card__badges">
          <DifficultyBadge :difficulty="score.difficulty" />
          <ComplexityBadge v-if="complexity != null" :complexity="complexity" />
        </div>
      </div>
      <dl class="pin-card__stats">
        <div class="pin-card__stat pin-card__stat--hero">
          <dt>AP</dt>
          <dd class="pin-card__stat-value">{{ apFormatted }}</dd>
          <dd class="pin-card__stat-sub">{{ weightedFormatted }} weighted</dd>
        </div>
        <div class="pin-card__stat">
          <dt>Acc</dt>
          <dd class="pin-card__stat-value">{{ accuracyPct }}<span class="pin-card__stat-unit">%</span></dd>
        </div>
        <div class="pin-card__stat">
          <dt>Rank</dt>
          <dd class="pin-card__stat-value pin-card__stat-rank" :class="getRankClass(score.rank)">
            #{{ score.rank }}
          </dd>
        </div>
      </dl>
    </div>

    <div class="pin-card__foot">
      <span class="pin-card__date">{{ formatRelativeDate(score.timeSet) }}</span>
      <ul v-if="modifierLabels.length" class="pin-card__mods">
        <li v-for="m in modifierLabels" :key="m">{{ m }}</li>
      </ul>
      <div class="pin-card__actions">
        <button v-if="canUnpin" class="pin-card__foot-btn pin-card__foot-btn--active" type="button"
          aria-label="Unpin score" aria-pressed="true" title="Unpin score" @click="onUnpinClick">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"
            stroke-width="1.5" stroke-linejoin="round">
            <path d="M9 4h6l-1 5 4 3v3h-5v6l-1 1-1-1v-6H6v-3l4-3-1-5z" />
          </svg>
        </button>
        <button v-if="replay" class="pin-card__foot-btn" type="button"
          :aria-label="replay.label" :title="replay.label" @click="onReplayClick">
          <img :src="replay.icon" alt="" width="16" height="16"
            style="border-radius: 2px; display: block;" loading="lazy" decoding="async" />
        </button>
        <button class="pin-card__foot-btn" type="button" aria-label="View score details" @click="onDetailClick">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 11L5.5 5L8 8L10.5 4L14 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
              stroke-linejoin="round" />
            <path d="M2 13H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>
  </a>
</template>

<style scoped>
.pin-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  text-decoration: none;
  color: inherit;
  transition: border-color 160ms cubic-bezier(0.22, 1, 0.36, 1), transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
  overflow: hidden;
  container-type: inline-size;
}

.pin-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(to right, transparent, var(--card-accent), transparent);
  opacity: 0.5;
  transition: opacity 160ms ease;
}

.pin-card:hover {
  border-color: color-mix(in srgb, var(--card-accent) 40%, var(--bg-overlay));
  transform: translateY(-2px);
}

.pin-card:hover::before {
  opacity: 1;
}

.pin-card__actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.pin-card__foot-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease;
}

.pin-card__foot-btn:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.pin-card__foot-btn--active {
  color: var(--card-accent, var(--accent));
  border-color: color-mix(in srgb, var(--card-accent, var(--accent)) 50%, var(--bg-overlay));
  background: color-mix(in srgb, var(--card-accent, var(--accent)) 10%, transparent);
}

.pin-card__foot-btn--active:hover {
  background: color-mix(in srgb, var(--card-accent, var(--accent)) 18%, transparent);
}

.pin-card__comment {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  text-align: left;
  margin: 0;
  padding: var(--space-xs) var(--space-sm);
  background: transparent;
  border: none;
  border-radius: var(--radius-input);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-style: italic;
  line-height: 1.5;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  cursor: default;
}

.pin-card__comment--editable {
  cursor: text;
  transition: background-color 120ms ease, color 120ms ease;
}

.pin-card__comment--editable:hover,
.pin-card__comment--editable:focus-visible {
  background: color-mix(in srgb, var(--bg-elevated) 60%, transparent);
  color: var(--text-primary);
  outline: none;
}

.pin-card__comment-mark {
  color: var(--text-tertiary);
  font-style: normal;
  margin: 0 1px;
}

.pin-card__comment-placeholder {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  align-self: flex-start;
  padding: 4px var(--space-sm);
  border: 1px dashed var(--bg-overlay);
  border-radius: var(--radius-input);
  background: transparent;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-style: italic;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease;
}

.pin-card__comment-placeholder:hover,
.pin-card__comment-placeholder:focus-visible {
  color: var(--text-secondary);
  border-color: var(--text-tertiary);
  background: color-mix(in srgb, var(--bg-elevated) 50%, transparent);
  outline: none;
}

.pin-card__comment-edit {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.pin-card__comment-input {
  width: 100%;
  resize: vertical;
  min-height: 56px;
  max-height: 200px;
  padding: var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-style: italic;
  line-height: 1.5;
  outline: none;
  transition: border-color 120ms ease;
}

.pin-card__comment-input:focus {
  border-color: var(--card-accent, var(--accent));
}

.pin-card__comment-input::placeholder {
  color: var(--text-tertiary);
}

.pin-card__comment-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  justify-content: flex-end;
  font-size: var(--text-caption);
}

.pin-card__comment-counter {
  flex: 1;
  font-family: var(--font-mono);
  color: var(--text-tertiary);
}

.pin-card__comment-counter--over {
  color: var(--error);
}

.pin-card__comment-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease;
}

.pin-card__comment-btn:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.pin-card__comment-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pin-card__comment-btn--primary {
  color: var(--card-accent, var(--accent));
  border-color: color-mix(in srgb, var(--card-accent, var(--accent)) 50%, var(--bg-overlay));
}

.pin-card__comment-btn--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--card-accent, var(--accent)) 14%, transparent);
}

.pin-card__body {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(140px, 1fr);
  align-items: center;
  gap: var(--space-lg);
}

.pin-card__cover {
  flex-shrink: 0;
}

.pin-card__map {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.pin-card__eyebrow {
  align-self: flex-start;
}

.pin-card__song {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.005em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pin-card__badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
}

.pin-card__stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin: 0;
  padding-left: var(--space-lg);
  border-left: 1px solid var(--bg-overlay);
  min-width: 132px;
}

.pin-card__stat {
  display: grid;
  grid-template-columns: auto auto;
  grid-auto-rows: auto;
  align-items: baseline;
  justify-content: space-between;
  column-gap: var(--space-xl);
  min-width: 0;
}

.pin-card__stat dt {
  grid-column: 1;
  grid-row: 1;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin: 0;
}

.pin-card__stat dd {
  margin: 0;
}

.pin-card__stat-value {
  grid-column: 2;
  grid-row: 1;
  font-family: var(--font-mono);
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  line-height: 1.1;
  text-align: right;
}

.pin-card__stat-sub {
  grid-column: 2;
  grid-row: 2;
}

.pin-card__stat--hero .pin-card__stat-value {
  font-size: 1.45rem;
  font-weight: 600;
  color: var(--card-accent);
}

.pin-card__stat--hero dt {
  color: var(--card-accent);
  opacity: 0.85;
}

.pin-card__stat-unit {
  font-size: 0.85em;
  color: var(--text-secondary);
  margin-left: 1px;
}

.pin-card__stat-sub {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--text-tertiary);
}

.pin-card__stat-rank.rank--gold {
  color: var(--tier-gold);
}
.pin-card__stat-rank.rank--silver {
  color: var(--tier-silver);
}
.pin-card__stat-rank.rank--bronze {
  color: var(--tier-bronze);
}

.pin-card__foot {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--text-caption);
}

.pin-card__date {
  color: var(--text-tertiary);
  white-space: nowrap;
}

.pin-card__mods {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  flex: 1;
  min-width: 0;
}

.pin-card__mods li {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.04em;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .pin-card,
  .pin-card::before {
    transition: none;
  }
  .pin-card:hover {
    transform: none;
  }
}

@container (max-width: 420px) {
  .pin-card__body {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: var(--space-md);
  }

  .pin-card__stats {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    padding-left: 0;
    padding-top: var(--space-sm);
    border-left: none;
    border-top: 1px solid var(--bg-overlay);
    min-width: 0;
  }

  .pin-card__stat {
    grid-template-columns: minmax(0, 1fr);
    grid-auto-rows: auto;
    justify-content: start;
    column-gap: 0;
    row-gap: 2px;
  }

  .pin-card__stat dt {
    grid-column: 1;
    grid-row: 1;
  }

  .pin-card__stat-value {
    grid-column: 1;
    grid-row: 2;
    text-align: left;
  }

  .pin-card__stat-sub {
    grid-column: 1;
    grid-row: 3;
  }

  .pin-card__stat--hero .pin-card__stat-value {
    font-size: 1.25rem;
  }
}
</style>
