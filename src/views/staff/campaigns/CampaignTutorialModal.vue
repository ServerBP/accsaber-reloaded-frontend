<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import CampaignRoadmap from '@/components/domain/CampaignRoadmap.vue'
import type {
  CampaignBarrierResponse,
  CampaignDifficultyResponse,
} from '@/types/api/campaigns'
import type { PublicMapDifficultyResponse } from '@/types/api/maps'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CampaignMapPicker from './CampaignMapPicker.vue'
import CampaignTrayIcon from './CampaignTrayIcon.vue'

withDefaults(defineProps<{ accent?: string }>(), {
  accent: 'var(--accent)',
})

const emit = defineEmits<{
  close: [outcome: 'done' | 'skipped']
}>()

type StepId = 'add' | 'connect' | 'goal' | 'reward' | 'barrier' | 'finish'

interface TutorialStep {
  id: StepId
  title: string
  body: string
}

const steps: TutorialStep[] = [
  {
    id: 'add',
    title: 'Add your first map',
    body: 'A campaign is a path of ranked maps. Click Add node at the bottom of the canvas, then pick any map you like.',
  },
  {
    id: 'connect',
    title: 'Connect the path',
    body: 'Add a second map. Then switch to Connect at the top of the canvas and drag a line from your first map to the new one.',
  },
  {
    id: 'goal',
    title: 'Set the goal',
    body: 'Players clear a map by reaching its goal. Set the accuracy your first map asks for.',
  },
  {
    id: 'reward',
    title: 'Reward the clear',
    body: 'Clearing a map can pay XP. Give your first map a reward.',
  },
  {
    id: 'barrier',
    title: 'Gate the path',
    body: 'A barrier gates everything after it. Add one more map and connect your second map to it. Then click Add barrier at the bottom of the canvas and click the new arrow.',
  },
  {
    id: 'finish',
    title: 'Make it yours',
    body: 'That is the whole loop. The trays on the left of the editor hold everything else:',
  },
]

const finishTrays = [
  { icon: 'identity', name: 'Identity', text: 'name, summary, description' },
  { icon: 'sliders', name: 'Settings', text: 'ordering and completion rules' },
  { icon: 'image', name: 'Images', text: 'background and icon' },
  { icon: 'gift', name: 'Rewards', text: 'a bonus for finishing everything' },
  { icon: 'users', name: 'Collab', text: 'invite others to build with you' },
  { icon: 'flag', name: 'Status', text: 'publish when you are ready' },
] as const

const stepIndex = ref(0)
const direction = ref<'fwd' | 'back'>('fwd')
const celebrating = ref(false)
let advanceTimer: number | null = null

const nodes = ref<CampaignDifficultyResponse[]>([])
const barriers = ref<CampaignBarrierResponse[]>([])
const sandboxMode = ref<'drag' | 'connect' | 'select'>('drag')
const selectedId = ref<string | null>(null)
const pickerOpen = ref(false)
const goalTouched = ref(false)
const barrierTouched = ref(false)
const barrierPlacement = ref(false)

let nodeSeq = 0

const currentStep = computed(() => steps[stepIndex.value])
const firstNode = computed(() => nodes.value[0] ?? null)
const hasConnection = computed(() =>
  nodes.value.some((n) => n.prerequisites.length > 0),
)

const firstBarrier = computed(() => barriers.value[0] ?? null)

const edgeCount = computed(
  () =>
    nodes.value.reduce((sum, n) => sum + n.prerequisites.length, 0) +
    barriers.value.reduce((sum, b) => sum + b.prerequisites.length, 0),
)

const thirdMapConnected = computed(() => nodes.value.length >= 3 && edgeCount.value >= 2)

const nodesBeforeGate = computed<CampaignDifficultyResponse[]>(() => {
  const barrier = firstBarrier.value
  if (!barrier) return []
  const forward = new Map<string, string[]>()
  const addEdge = (from: string, to: string) => {
    const list = forward.get(from) ?? []
    list.push(to)
    forward.set(from, list)
  }
  for (const n of nodes.value) {
    for (const p of n.prerequisites) addEdge(p.comesFromCampaignDifficultyId, n.id)
  }
  for (const b of barriers.value) {
    for (const p of b.prerequisites) addEdge(p.comesFromCampaignDifficultyId, b.id)
  }
  const beyond = new Set<string>()
  const queue = [barrier.id]
  while (queue.length > 0) {
    const current = queue.pop() as string
    for (const next of forward.get(current) ?? []) {
      if (!beyond.has(next)) {
        beyond.add(next)
        queue.push(next)
      }
    }
  }
  return nodes.value.filter((n) => !beyond.has(n.id))
})

const watchesMapsBefore = computed(() => {
  const barrier = firstBarrier.value
  if (!barrier) return false
  const before = nodesBeforeGate.value
  if (before.length === 0) return false
  return before.every((n) => barrier.affectedCampaignDifficultyIds.includes(n.id))
})

const stepDone = computed<boolean[]>(() => [
  nodes.value.length >= 1,
  nodes.value.length >= 2 && hasConnection.value,
  goalTouched.value,
  (firstNode.value?.xp ?? 0) > 0,
  thirdMapConnected.value &&
    barriers.value.length >= 1 &&
    barrierTouched.value &&
    watchesMapsBefore.value,
  false,
])

const wantsAdd = computed(
  () =>
    (currentStep.value.id === 'add' && nodes.value.length === 0) ||
    (currentStep.value.id === 'connect' && nodes.value.length < 2) ||
    (currentStep.value.id === 'barrier' && nodes.value.length < 3),
)

const wantsBarrier = computed(
  () =>
    currentStep.value.id === 'barrier' &&
    thirdMapConnected.value &&
    barriers.value.length === 0 &&
    !barrierPlacement.value,
)

const wantsConnectMode = computed(
  () =>
    currentStep.value.id === 'connect' &&
    nodes.value.length >= 2 &&
    !hasConnection.value &&
    sandboxMode.value !== 'connect',
)

const goalPct = computed({
  get: () => Math.round((firstNode.value?.requirementValue ?? 0.95) * 1000) / 10,
  set: (v: number) => {
    const node = firstNode.value
    if (!node) return
    const clamped = Math.min(100, Math.max(70, Number(v) || 70))
    node.requirementValue = Math.round(clamped * 10) / 1000
  },
})

const xpValue = computed({
  get: () => firstNode.value?.xp ?? 0,
  set: (v: number) => {
    const node = firstNode.value
    if (!node) return
    node.xp = Math.max(0, Math.round(Number(v) || 0))
  },
})

function commitGoal() {
  if (!firstNode.value) return
  goalTouched.value = true
  checkAutoAdvance()
}

function setXpPreset(v: number) {
  xpValue.value = v
  checkAutoAdvance()
}

function commitXp() {
  checkAutoAdvance()
}

function toNode(meta: PublicMapDifficultyResponse): CampaignDifficultyResponse {
  nodeSeq += 1
  return {
    id: `tutorial-${nodeSeq}`,
    mapDifficultyId: meta.id,
    mapId: meta.mapId,
    categoryId: meta.categoryId,
    complexity: meta.complexity,
    beatsaverCode: meta.beatsaverCode,
    maxScore: meta.maxScore,
    metadata: meta.metadata,
    nps: meta.nps,
    maxCombo: meta.maxCombo,
    songName: meta.songName,
    songAuthor: meta.songAuthor,
    mapAuthor: meta.mapAuthor,
    coverUrl: meta.coverUrl,
    cdnCoverUrl: meta.cdnCoverUrl ?? null,
    difficulty: meta.difficulty,
    characteristic: meta.characteristic,
    targetMode: 'AND',
    targets: [
      { requirementType: 'ACC', requirementValue: 0.95, requirementValueMax: null },
    ],
    requirementType: 'ACC',
    requirementValue: 0.95,
    requirementValueMax: null,
    modifiers: [],
    description: null,
    checkpointLabel: null,
    checkpointLabelPosition: null,
    checkpointAvatarUrl: null,
    nodeBorderUrl: null,
    nodeBorderLayer: 'ABOVE',
    borderColor: null,
    borderShape: null,
    checkpointColor: null,
    checkpointSize: null,
    size: null,
    positionX: nodes.value.length * 2,
    positionY: 0,
    xp: 0,
    prerequisites: [],
    prerequisiteMode: 'AND',
    items: [],
  }
}

function handlePicked(picked: PublicMapDifficultyResponse[]) {
  if (picked.length === 0) return
  for (const meta of picked) {
    nodes.value = [...nodes.value, toNode(meta)]
  }
  pickerOpen.value = false
  if (nodes.value.length === 1) selectedId.value = nodes.value[0].id
  checkAutoAdvance()
}

function handleMove(payload: { id: string; positionX: number; positionY: number }) {
  const vertex = vertexById(payload.id)
  if (!vertex) return
  vertex.positionX = payload.positionX
  vertex.positionY = payload.positionY
}

function handleEmptyClick() {
  selectedId.value = null
  barrierPlacement.value = false
}

function handleConnect(payload: { fromId: string; toId: string }) {
  if (payload.fromId === payload.toId) return
  const from = vertexById(payload.fromId)
  const to = vertexById(payload.toId)
  if (!from || !to) return
  if (to.prerequisites.some((p) => p.comesFromCampaignDifficultyId === payload.fromId)) return
  if (from.prerequisites.some((p) => p.comesFromCampaignDifficultyId === payload.toId)) return
  to.prerequisites = [
    ...to.prerequisites,
    { comesFromCampaignDifficultyId: payload.fromId, color: null },
  ]
  checkAutoAdvance()
}

function handleDisconnect(payload: { fromId: string; toId: string }) {
  const to = vertexById(payload.toId)
  if (!to) return
  to.prerequisites = to.prerequisites.filter(
    (p) => p.comesFromCampaignDifficultyId !== payload.fromId,
  )
}

function vertexById(
  id: string,
): CampaignDifficultyResponse | CampaignBarrierResponse | null {
  return (
    nodes.value.find((n) => n.id === id) ?? barriers.value.find((b) => b.id === id) ?? null
  )
}

function toggleBarrierPlacement() {
  if (!hasConnection.value) return
  barrierPlacement.value = !barrierPlacement.value
}

function handlePlaceBarrier(payload: { fromId: string; toId: string }) {
  const from = vertexById(payload.fromId)
  const to = vertexById(payload.toId)
  if (!from || !to) return
  nodeSeq += 1
  const barrier: CampaignBarrierResponse = {
    id: `tutorial-barrier-${nodeSeq}`,
    conditionType: 'AVERAGE_ACC',
    conditionValue: 0.9,
    conditionValueMax: null,
    description: null,
    checkpointLabel: null,
    checkpointLabelPosition: null,
    checkpointAvatarUrl: null,
    checkpointColor: null,
    borderColor: null,
    borderShape: null,
    size: null,
    checkpointSize: null,
    positionX: Math.round((from.positionX + to.positionX) / 2),
    positionY: Math.round((from.positionY + to.positionY) / 2),
    xp: 0,
    prerequisites: [{ comesFromCampaignDifficultyId: payload.fromId, color: null }],
    prerequisiteMode: 'AND',
    affectedCampaignDifficultyIds: payload.fromId.startsWith('tutorial-barrier')
      ? []
      : [payload.fromId],
    items: [],
  }
  barriers.value = [...barriers.value, barrier]
  to.prerequisites = to.prerequisites
    .filter((p) => p.comesFromCampaignDifficultyId !== payload.fromId)
    .concat({ comesFromCampaignDifficultyId: barrier.id, color: null })
  barrierPlacement.value = false
  selectedId.value = barrier.id
  checkAutoAdvance()
}

function toggleWatched(nodeId: string) {
  const barrier = firstBarrier.value
  if (!barrier) return
  const current = barrier.affectedCampaignDifficultyIds
  barrier.affectedCampaignDifficultyIds = current.includes(nodeId)
    ? current.filter((id) => id !== nodeId)
    : [...current, nodeId]
  checkAutoAdvance()
}

const barrierPct = computed({
  get: () => Math.round((firstBarrier.value?.conditionValue ?? 0.9) * 1000) / 10,
  set: (v: number) => {
    const barrier = firstBarrier.value
    if (!barrier) return
    const clamped = Math.min(100, Math.max(70, Number(v) || 70))
    barrier.conditionValue = Math.round(clamped * 10) / 1000
  },
})

function commitBarrierValue() {
  if (!firstBarrier.value) return
  barrierTouched.value = true
  checkAutoAdvance()
}

function clearAdvanceTimer() {
  if (advanceTimer != null) {
    window.clearTimeout(advanceTimer)
    advanceTimer = null
  }
  celebrating.value = false
}

function checkAutoAdvance() {
  if (stepIndex.value >= steps.length - 1) return
  if (!stepDone.value[stepIndex.value]) return
  if (celebrating.value) return
  celebrating.value = true
  advanceTimer = window.setTimeout(() => {
    advanceTimer = null
    celebrating.value = false
    if (stepDone.value[stepIndex.value]) goNext()
  }, 900)
}

function goNext() {
  clearAdvanceTimer()
  if (stepIndex.value >= steps.length - 1) return
  direction.value = 'fwd'
  stepIndex.value += 1
}

function goBack() {
  clearAdvanceTimer()
  if (stepIndex.value === 0) return
  direction.value = 'back'
  stepIndex.value -= 1
}

function skipStep() {
  goNext()
}

function resetTutorial() {
  clearAdvanceTimer()
  nodes.value = []
  barriers.value = []
  selectedId.value = null
  sandboxMode.value = 'drag'
  barrierPlacement.value = false
  pickerOpen.value = false
  goalTouched.value = false
  barrierTouched.value = false
  direction.value = 'back'
  stepIndex.value = 0
}

function skipAll() {
  clearAdvanceTimer()
  emit('close', 'skipped')
}

function finish() {
  clearAdvanceTimer()
  emit('close', 'done')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (pickerOpen.value) return
  skipAll()
}

const dialogEl = ref<HTMLElement | null>(null)

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'
  dialogEl.value?.focus()
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
  clearAdvanceTimer()
})
</script>

<template>
  <Teleport to="body">
    <div class="tutorial-backdrop">
      <div
        ref="dialogEl"
        class="tutorial"
        role="dialog"
        aria-modal="true"
        aria-label="Campaign editor tutorial"
        tabindex="-1"
        :style="{ '--tutorial-accent': accent }"
      >
        <header class="tutorial__head">
          <h2 class="tutorial__title">Build your first campaign</h2>
          <div class="tutorial__progress" aria-label="Tutorial progress">
            <span class="tutorial__progress-count">{{ stepIndex + 1 }} / {{ steps.length }}</span>
            <span
              v-for="(s, i) in steps"
              :key="s.id"
              class="tutorial__progress-seg"
              :class="{
                'tutorial__progress-seg--done': stepDone[i] || i < stepIndex,
                'tutorial__progress-seg--current': i === stepIndex,
              }"
            />
          </div>
          <button
            v-if="nodes.length > 0 || barriers.length > 0 || stepIndex > 0"
            type="button"
            class="tutorial__reset"
            @click="resetTutorial"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Start over
          </button>
          <BaseButton size="sm" @click="skipAll">Skip tutorial</BaseButton>
        </header>

        <div class="tutorial__body">
          <div class="tutorial__stage">
            <CampaignRoadmap
              :difficulties="nodes"
              :barriers="barriers"
              :accent-color="accent"
              :show-starfield="true"
              :default-scale="1"
              :follow-focus="false"
              :selected-id="selectedId"
              :barrier-placement="barrierPlacement"
              :editable="true"
              :mode="sandboxMode"
              @select="selectedId = $event"
              @deselect="selectedId = null"
              @empty-click="handleEmptyClick"
              @move="handleMove"
              @connect="handleConnect"
              @disconnect="handleDisconnect"
              @place-barrier="handlePlaceBarrier"
            >
              <template #actions>
                <div class="tutorial__add-cluster">
                  <button
                    type="button"
                    class="tutorial__add-btn"
                    :class="{ 'tutorial__add-btn--attn': wantsAdd }"
                    @click="pickerOpen = true"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add node
                  </button>
                  <button
                    type="button"
                    class="tutorial__add-btn"
                    :class="{
                      'tutorial__add-btn--attn': wantsBarrier,
                      'tutorial__add-btn--armed': barrierPlacement,
                    }"
                    :disabled="!hasConnection"
                    :title="!hasConnection ? 'Connect two nodes first, then drop a gate on the arrow' : ''"
                    @click="toggleBarrierPlacement"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="12" y1="3" x2="12" y2="21" />
                      <line x1="7" y1="6" x2="17" y2="6" />
                      <line x1="7" y1="18" x2="17" y2="18" />
                    </svg>
                    {{ barrierPlacement ? 'Pick an arrow' : 'Add barrier' }}
                  </button>
                </div>
              </template>
            </CampaignRoadmap>

            <div class="tutorial__mode" role="radiogroup" aria-label="Canvas mode">
              <button
                type="button"
                role="radio"
                :aria-checked="sandboxMode === 'drag'"
                class="tutorial__mode-btn"
                :class="{ 'tutorial__mode-btn--active': sandboxMode === 'drag' }"
                @click="sandboxMode = 'drag'"
              >
                Drag
              </button>
              <button
                type="button"
                role="radio"
                :aria-checked="sandboxMode === 'connect'"
                class="tutorial__mode-btn"
                :class="{
                  'tutorial__mode-btn--active': sandboxMode === 'connect',
                  'tutorial__mode-btn--attn': wantsConnectMode,
                }"
                @click="sandboxMode = 'connect'"
              >
                Connect
              </button>
              <button
                type="button"
                role="radio"
                :aria-checked="sandboxMode === 'select'"
                class="tutorial__mode-btn"
                :class="{ 'tutorial__mode-btn--active': sandboxMode === 'select' }"
                @click="sandboxMode = 'select'"
              >
                Select
              </button>
            </div>

            <p class="tutorial__sandbox-tag">Practice canvas. Nothing here is saved.</p>
          </div>

          <aside class="tutorial__panel">
            <Transition :name="direction === 'fwd' ? 'tutorial-step-fwd' : 'tutorial-step-back'" mode="out-in">
              <div :key="currentStep.id" class="tutorial__step" aria-live="polite">
                <p class="tutorial__step-count">Step {{ stepIndex + 1 }}</p>
                <h3 class="tutorial__step-title">{{ currentStep.title }}</h3>
                <p class="tutorial__step-body">{{ currentStep.body }}</p>

                <ul v-if="currentStep.id === 'connect'" class="tutorial__checklist">
                  <li :class="{ 'tutorial__check--on': nodes.length >= 2 }">
                    <span class="tutorial__check-box" aria-hidden="true">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    Two maps on the canvas
                  </li>
                  <li :class="{ 'tutorial__check--on': hasConnection }">
                    <span class="tutorial__check-box" aria-hidden="true">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    An arrow between them
                  </li>
                </ul>

                <div v-if="currentStep.id === 'goal'" class="tutorial__control">
                  <template v-if="firstNode">
                    <label class="tutorial__field">
                      <span>Target (%)</span>
                      <div class="tutorial__slider-row">
                        <input
                          v-model.number="goalPct"
                          type="range"
                          min="70"
                          max="100"
                          step="0.1"
                          @change="commitGoal"
                        />
                        <input
                          v-model.number.lazy="goalPct"
                          type="number"
                          min="70"
                          max="100"
                          step="0.1"
                          @change="commitGoal"
                        />
                      </div>
                    </label>
                  </template>
                  <p v-else class="tutorial__note">Add a map to the canvas to try this.</p>
                </div>

                <div v-if="currentStep.id === 'reward'" class="tutorial__control">
                  <template v-if="firstNode">
                    <label class="tutorial__field">
                      <span>XP</span>
                      <div class="tutorial__xp-row">
                        <button
                          v-for="preset in [25, 50, 100]"
                          :key="preset"
                          type="button"
                          class="tutorial__xp-preset"
                          :class="{ 'tutorial__xp-preset--active': xpValue === preset }"
                          @click="setXpPreset(preset)"
                        >
                          {{ preset }}
                        </button>
                        <input v-model.number.lazy="xpValue" type="number" min="0" step="5" @change="commitXp" />
                      </div>
                    </label>
                  </template>
                  <p v-else class="tutorial__note">Add a map to the canvas to try this.</p>
                </div>

                <template v-if="currentStep.id === 'barrier'">
                  <ul class="tutorial__checklist">
                    <li :class="{ 'tutorial__check--on': thirdMapConnected }">
                      <span class="tutorial__check-box" aria-hidden="true">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      One more map, connected in
                    </li>
                    <li :class="{ 'tutorial__check--on': barriers.length >= 1 }">
                      <span class="tutorial__check-box" aria-hidden="true">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      A gate on the new arrow
                    </li>
                    <li :class="{ 'tutorial__check--on': barrierTouched }">
                      <span class="tutorial__check-box" aria-hidden="true">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      A requirement set
                    </li>
                    <li :class="{ 'tutorial__check--on': watchesMapsBefore }">
                      <span class="tutorial__check-box" aria-hidden="true">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      It watches the maps before it
                    </li>
                  </ul>

                  <p v-if="!hasConnection" class="tutorial__note">
                    You need two connected maps first. Go back a few steps, or add and connect them
                    right here.
                  </p>

                  <div v-if="firstBarrier" class="tutorial__control">
                    <label class="tutorial__field">
                      <span>Requirement: average acc (%)</span>
                      <div class="tutorial__slider-row">
                        <input
                          v-model.number="barrierPct"
                          type="range"
                          min="70"
                          max="100"
                          step="0.5"
                          @change="commitBarrierValue"
                        />
                        <input
                          v-model.number.lazy="barrierPct"
                          type="number"
                          min="70"
                          max="100"
                          step="0.5"
                          @change="commitBarrierValue"
                        />
                      </div>
                    </label>
                    <div class="tutorial__field tutorial__field--gap">
                      <span>Maps the gate watches</span>
                      <div class="tutorial__watch-row">
                        <button
                          v-for="n in nodesBeforeGate"
                          :key="n.id"
                          type="button"
                          class="tutorial__watch-chip"
                          :class="{
                            'tutorial__watch-chip--active':
                              firstBarrier.affectedCampaignDifficultyIds.includes(n.id),
                          }"
                          :aria-pressed="firstBarrier.affectedCampaignDifficultyIds.includes(n.id)"
                          @click="toggleWatched(n.id)"
                        >
                          {{ n.songName }}
                        </button>
                      </div>
                    </div>
                  </div>
                </template>

                <ul v-if="currentStep.id === 'finish'" class="tutorial__trays">
                  <li v-for="t in finishTrays" :key="t.icon">
                    <span class="tutorial__tray-icon" aria-hidden="true">
                      <CampaignTrayIcon :name="t.icon" :size="15" />
                    </span>
                    <span class="tutorial__tray-text">
                      <strong>{{ t.name }}</strong> {{ t.text }}
                    </span>
                  </li>
                </ul>

                <p v-if="currentStep.id === 'add'" class="tutorial__note">
                  The picker only lists ranked maps.
                </p>
                <p v-if="currentStep.id === 'connect'" class="tutorial__note">
                  Arrows set the order players clear maps in. Click the x in the middle of an arrow
                  to remove it.
                </p>
                <p v-if="currentStep.id === 'goal'" class="tutorial__note">
                  In the editor this lives in the Goal tray, on the left rail, whenever a node is
                  selected. Goals can also be AP, score, rank, a 115 streak, or a full combo.
                </p>
                <p v-if="currentStep.id === 'reward'" class="tutorial__note">
                  In the editor this is the node's Rewards tray on the left rail. You can also
                  attach inventory items there if you want. XP is enough for now.
                </p>
                <p v-if="currentStep.id === 'barrier'" class="tutorial__note">
                  The gate opens once the maps it watches average the target accuracy, so it only
                  ever watches maps before it. In the editor this lives in the gate's Condition and
                  Affected trays on the left rail, with more condition types to pick from.
                </p>
                <p v-if="currentStep.id === 'finish'" class="tutorial__note">
                  Your campaign saves as a draft while you build. When you feel at home, look for
                  text labels, milestones, and node shapes.
                </p>
              </div>
            </Transition>

            <Transition name="tutorial-status">
              <div v-if="celebrating" class="tutorial__done" role="status">
                <svg
                  class="tutorial__done-check"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Done
              </div>
            </Transition>

            <footer class="tutorial__foot">
              <BaseButton size="sm" :disabled="stepIndex === 0" @click="goBack">Back</BaseButton>
              <span class="tutorial__foot-gap" />
              <button
                v-if="currentStep.id !== 'finish' && !stepDone[stepIndex]"
                type="button"
                class="tutorial__skip-step"
                @click="skipStep"
              >
                Skip step
              </button>
              <BaseButton
                v-if="currentStep.id !== 'finish'"
                size="sm"
                variant="primary"
                :disabled="!stepDone[stepIndex]"
                @click="goNext"
              >
                Next
              </BaseButton>
              <BaseButton v-else size="sm" variant="primary" @click="finish">Finish</BaseButton>
            </footer>
          </aside>
        </div>
      </div>

      <CampaignMapPicker
        v-if="pickerOpen"
        @close="pickerOpen = false"
        @pick="handlePicked"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.tutorial-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  animation: tutorial-fade-in 150ms ease-out;
}

.tutorial {
  display: flex;
  flex-direction: column;
  width: min(1180px, 100%);
  height: min(760px, 100%);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-modal);
  overflow: hidden;
  outline: none;
  animation: tutorial-scale-in 200ms ease-out;
}

@keyframes tutorial-fade-in {
  from {
    opacity: 0;
  }
}

@keyframes tutorial-scale-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
}

.tutorial__head {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-sm) var(--space-md) var(--space-sm) var(--space-lg);
  border-bottom: 1px solid var(--bg-overlay);
}

.tutorial__title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 650;
  color: var(--text-primary);
}

.tutorial__progress {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
}

.tutorial__progress-count {
  margin-right: var(--space-sm);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.tutorial__progress-seg {
  width: 26px;
  height: 3px;
  border-radius: 2px;
  background: var(--bg-overlay);
  transition: background-color 200ms ease;
}

.tutorial__progress-seg--current {
  background: color-mix(in srgb, var(--tutorial-accent) 45%, var(--bg-overlay));
}

.tutorial__progress-seg--done {
  background: var(--tutorial-accent);
}

.tutorial__reset {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  background: transparent;
  border: none;
  border-radius: 3px;
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 120ms ease;
}

.tutorial__reset:hover {
  color: var(--text-primary);
}

.tutorial__body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.tutorial__stage {
  position: relative;
  flex: 1;
  min-width: 0;
  background: var(--bg-base);
  overflow: hidden;
}

.tutorial__add-cluster {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
  pointer-events: auto;
}

.tutorial__add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--tutorial-accent);
  background: transparent;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  transition:
    background 120ms ease,
    color 120ms ease;
}

.tutorial__add-btn:hover {
  background: var(--bg-elevated);
}

.tutorial__add-btn:disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.tutorial__add-btn:disabled:hover {
  background: transparent;
}

.tutorial__add-btn--attn {
  background: color-mix(in srgb, var(--tutorial-accent) 14%, transparent);
  animation: tutorial-attn-pulse 1.6s ease-in-out infinite;
}

.tutorial__add-btn--armed,
.tutorial__add-btn--armed:hover {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 14%, transparent);
}

.tutorial__mode {
  position: absolute;
  top: var(--space-md);
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
  transition: border-color 120ms ease;
}

.tutorial__mode:has(.tutorial__mode-btn--attn) {
  border-color: var(--tutorial-accent);
}

.tutorial__mode-btn {
  padding: 6px 14px;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  transition:
    color 120ms ease,
    background 120ms ease;
}

.tutorial__mode-btn:hover {
  color: var(--text-primary);
}

.tutorial__mode-btn--active {
  color: var(--tutorial-accent);
  background: var(--bg-elevated);
}

.tutorial__mode-btn--attn {
  color: var(--tutorial-accent);
  background: color-mix(in srgb, var(--tutorial-accent) 14%, transparent);
  animation: tutorial-attn-pulse 1.6s ease-in-out infinite;
}

@keyframes tutorial-attn-pulse {
  0%,
  100% {
    background-color: color-mix(in srgb, var(--tutorial-accent) 10%, transparent);
  }
  50% {
    background-color: color-mix(in srgb, var(--tutorial-accent) 28%, transparent);
  }
}

.tutorial__sandbox-tag {
  position: absolute;
  right: var(--space-md);
  bottom: var(--space-md);
  margin: 0;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  pointer-events: none;
}

.tutorial__panel {
  display: flex;
  flex-direction: column;
  width: 340px;
  flex-shrink: 0;
  border-left: 1px solid var(--bg-overlay);
}

.tutorial__step {
  flex: 1;
  padding: var(--space-lg);
  overflow-y: auto;
}

.tutorial__step-count {
  margin: 0 0 var(--space-xs);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-tertiary);
}

.tutorial__step-title {
  margin: 0 0 var(--space-sm);
  font-size: 1.0625rem;
  font-weight: 650;
  color: var(--text-primary);
}

.tutorial__step-body {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--text-secondary);
}

.tutorial__error {
  margin: var(--space-md) 0 0;
  font-size: 0.8125rem;
  color: var(--error);
}

.tutorial__checklist {
  margin: var(--space-md) 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.tutorial__checklist li {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.8125rem;
  color: var(--text-secondary);
  transition: color 150ms ease;
}

.tutorial__check-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1px solid var(--bg-overlay);
  border-radius: 3px;
  color: transparent;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease;
}

.tutorial__check--on {
  color: var(--text-primary);
}

.tutorial__check--on .tutorial__check-box {
  border-color: var(--success);
  background: color-mix(in srgb, var(--success) 15%, transparent);
  color: var(--success);
}

.tutorial__control {
  margin-top: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
}

.tutorial__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.tutorial__field > span {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.tutorial__slider-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.tutorial__slider-row input[type='range'] {
  flex: 1;
  accent-color: var(--tutorial-accent);
}

.tutorial__slider-row input[type='number'],
.tutorial__xp-row input[type='number'] {
  width: 72px;
  padding: 5px 8px;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
}

.tutorial__slider-row input[type='number']:focus,
.tutorial__xp-row input[type='number']:focus {
  outline: none;
  border-color: var(--tutorial-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--tutorial-accent) 20%, transparent);
}

.tutorial__xp-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.tutorial__xp-preset {
  padding: 5px 12px;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  cursor: pointer;
  transition:
    border-color 120ms ease,
    background 120ms ease,
    color 120ms ease;
}

.tutorial__xp-preset:hover {
  background: var(--bg-elevated);
}

.tutorial__xp-preset--active {
  border-color: var(--tutorial-accent);
  color: var(--tutorial-accent);
}

.tutorial__field--gap {
  margin-top: var(--space-md);
}

.tutorial__watch-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.tutorial__watch-chip {
  max-width: 100%;
  padding: 5px 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  cursor: pointer;
  transition:
    border-color 120ms ease,
    background 120ms ease,
    color 120ms ease;
}

.tutorial__watch-chip:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.tutorial__watch-chip--active {
  border-color: var(--tutorial-accent);
  color: var(--tutorial-accent);
}

.tutorial__trays {
  margin: var(--space-md) 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.tutorial__trays li {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.tutorial__tray-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  color: var(--text-secondary);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 4px;
}

.tutorial__tray-text {
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--text-secondary);
}

.tutorial__tray-text strong {
  font-weight: 600;
  color: var(--text-primary);
}

.tutorial__note {
  margin: var(--space-md) 0 0;
  padding-top: var(--space-md);
  border-top: 1px solid var(--bg-overlay);
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--text-tertiary);
}

.tutorial__done {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0 var(--space-lg);
  padding: var(--space-sm) 0;
  border-top: 1px solid var(--bg-overlay);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--success);
}

.tutorial__done-check polyline {
  stroke-dasharray: 24;
  stroke-dashoffset: 0;
  animation: tutorial-check-draw 250ms ease-out;
}

@keyframes tutorial-check-draw {
  from {
    stroke-dashoffset: 24;
  }
}

.tutorial__foot {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  border-top: 1px solid var(--bg-overlay);
}

.tutorial__foot-gap {
  flex: 1;
}

.tutorial__skip-step {
  padding: 5px 8px;
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 120ms ease;
}

.tutorial__skip-step:hover {
  color: var(--text-primary);
}

.tutorial-step-fwd-enter-active,
.tutorial-step-back-enter-active {
  transition:
    opacity 160ms ease-out,
    transform 160ms ease-out;
}

.tutorial-step-fwd-leave-active,
.tutorial-step-back-leave-active {
  transition:
    opacity 120ms ease-in,
    transform 120ms ease-in;
}

.tutorial-step-fwd-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.tutorial-step-fwd-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.tutorial-step-back-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.tutorial-step-back-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

.tutorial-status-enter-active {
  transition:
    opacity 150ms ease-out,
    transform 150ms ease-out;
}

.tutorial-status-leave-active {
  transition: opacity 120ms ease-in;
}

.tutorial-status-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.tutorial-status-leave-to {
  opacity: 0;
}

@media (max-width: 860px) {
  .tutorial-backdrop {
    padding: var(--space-sm);
  }

  .tutorial {
    height: 100%;
  }

  .tutorial__head {
    flex-wrap: wrap;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
  }

  .tutorial__body {
    flex-direction: column;
  }

  .tutorial__stage {
    flex: none;
    height: 42%;
    min-height: 220px;
  }

  .tutorial__panel {
    flex: 1;
    width: auto;
    min-height: 0;
    border-left: none;
    border-top: 1px solid var(--bg-overlay);
  }

  .tutorial__step {
    padding: var(--space-md);
  }

  .tutorial__sandbox-tag {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tutorial-backdrop,
  .tutorial,
  .tutorial__done-check polyline,
  .tutorial__add-btn--attn,
  .tutorial__mode-btn--attn {
    animation: none;
  }

  .tutorial-step-fwd-enter-active,
  .tutorial-step-fwd-leave-active,
  .tutorial-step-back-enter-active,
  .tutorial-step-back-leave-active,
  .tutorial-status-enter-active,
  .tutorial-status-leave-active,
  .tutorial__progress-seg {
    transition: none;
  }
}
</style>
