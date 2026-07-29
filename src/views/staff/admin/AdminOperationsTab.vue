<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import ResourcePicker from '@/components/domain/ResourcePicker.vue'
import { parseApiError } from '@/api/client'
import type { JobResponse, JobTypeResponse, RunJobRequest } from '@/types/api/jobs'
import { useCategoryStore } from '@/stores/categories'
import JobRunner from './operations/JobRunner.vue'
import JobsList from './operations/JobsList.vue'
import { RESOURCE_SOURCES } from './operations/resourceSources'

const categoryStore = useCategoryStore()

const userSource = RESOURCE_SOURCES.USER!
const difficultySource = RESOURCE_SOURCES.MAP_DIFFICULTY!

interface OpState { loading: boolean; result: string | null; ok: boolean }
function makeOp(): OpState { return { loading: false, result: null, ok: false } }

function describeFailure(err: unknown): string {
  const parsed = parseApiError(err, 'Failed. Check server logs.')
  if (parsed.fieldErrors.length > 0) {
    return parsed.fieldErrors.map((f) => `${f.field}: ${f.message}`).join(' ')
  }
  return parsed.message
}

async function run(op: OpState, fn: () => Promise<void>, msg: string) {
  op.loading = true
  op.result = null
  try {
    await fn()
    op.ok = true
    op.result = msg
  } catch (err) {
    op.ok = false
    op.result = describeFailure(err)
  } finally {
    op.loading = false
  }
}

const jobTypes = ref<JobTypeResponse[]>([])
const typesLoading = ref(false)
const typesError = ref<string | null>(null)

const jobs = ref<JobResponse[]>([])
const jobsLoading = ref(false)
const jobsError = ref<string | null>(null)

const submitting = ref(false)
const submitError = ref<string | null>(null)
const submitNotice = ref<string | null>(null)

let jobPoll: ReturnType<typeof setTimeout> | null = null
const RUNNING_POLL_MS = 4000

const jobLabels = computed(() =>
  Object.fromEntries(jobTypes.value.map((t) => [t.type, t.label])),
)

const runningTypes = computed(() =>
  jobs.value.filter((j) => j.status === 'RUNNING').map((j) => j.type),
)

async function loadJobTypes() {
  typesLoading.value = true
  try {
    const { getJobTypes } = await import('@/api/admin/jobs')
    jobTypes.value = await getJobTypes()
    typesError.value = null
  } catch (err) {
    typesError.value = describeFailure(err)
  } finally {
    typesLoading.value = false
  }
}

function scheduleJobPoll() {
  if (jobPoll) clearTimeout(jobPoll)
  jobPoll = null
  if (runningTypes.value.length === 0) return
  jobPoll = setTimeout(() => {
    void refreshJobs()
  }, RUNNING_POLL_MS)
}

async function refreshJobs() {
  jobsLoading.value = true
  try {
    const { getJobs } = await import('@/api/admin/jobs')
    jobs.value = await getJobs()
    jobsError.value = null
  } catch (err) {
    jobsError.value = describeFailure(err)
  } finally {
    jobsLoading.value = false
    scheduleJobPoll()
  }
}

async function submitJob(request: RunJobRequest) {
  submitting.value = true
  submitError.value = null
  submitNotice.value = null
  try {
    const { runJob } = await import('@/api/admin/jobs')
    const job = await runJob(request)
    submitNotice.value = `${jobLabels.value[job.type] ?? job.type} started.`
    await refreshJobs()
  } catch (err) {
    submitError.value = describeFailure(err)
  } finally {
    submitting.value = false
  }
}

void loadJobTypes()
void refreshJobs()

onUnmounted(() => {
  if (jobPoll) clearTimeout(jobPoll)
})

const playerStats = ref(makeOp())
const statsUserId = ref<string | null>(null)
const statsCategoryId = ref('')

async function recalcPlayerStats() {
  const userId = statsUserId.value
  if (!userId || !statsCategoryId.value) return
  run(playerStats.value, async () => {
    const { recalculatePlayerStats } = await import('@/api/admin/recalculation')
    await recalculatePlayerStats(userId, statsCategoryId.value)
    statsUserId.value = null
  }, 'Player stats recalculated.')
}

const removeScoreOp = ref(makeOp())
const removeScoreUserId = ref<string | null>(null)
const removeScoreDiffId = ref<string | null>(null)
const removeScoreReason = ref('')

async function removeScore() {
  const userId = removeScoreUserId.value
  const mapDifficultyId = removeScoreDiffId.value
  if (!userId || !mapDifficultyId) return
  if (!confirm('Remove this score? The user will be re-fetched to avoid re-importing it.')) return
  run(removeScoreOp.value, async () => {
    const { removeScore: api } = await import('@/api/admin/recalculation')
    await api({ userId, mapDifficultyId, reason: removeScoreReason.value || undefined })
    removeScoreUserId.value = null
    removeScoreDiffId.value = null
    removeScoreReason.value = ''
  }, 'Score removal queued.')
}

const playerRefresh = ref(makeOp())
const refreshUserId = ref<string | null>(null)
const refreshAllOp = ref(makeOp())

async function refreshPlayer() {
  const userId = refreshUserId.value
  if (!userId) return
  run(playerRefresh.value, async () => {
    const { refreshPlayer: api } = await import('@/api/admin/recalculation')
    await api(userId)
    refreshUserId.value = null
  }, 'Player refresh queued.')
}

async function refreshAll() {
  if (!confirm('Refresh ALL players? This is a heavy background job.')) return
  run(refreshAllOp.value, async () => {
    const { refreshAllPlayers } = await import('@/api/admin/recalculation')
    await refreshAllPlayers()
  }, 'All-player refresh queued.')
}

const wsStatus = ref<Record<string, unknown> | null>(null)
const wsLoading = ref(false)
const wsReconnecting = ref<Record<string, boolean>>({})

async function fetchWsStatus() {
  wsLoading.value = true
  try {
    const { getWsStatus } = await import('@/api/admin/recalculation')
    wsStatus.value = await getWsStatus()
  } finally {
    wsLoading.value = false
  }
}
fetchWsStatus()

async function reconnect(platform: 'beatleader' | 'scoresaber') {
  wsReconnecting.value[platform] = true
  try {
    const { reconnectWs } = await import('@/api/admin/recalculation')
    await reconnectWs(platform)
    await fetchWsStatus()
  } finally {
    delete wsReconnecting.value[platform]
  }
}
</script>

<template>
  <div class="tab">
    <div class="tab__header">
      <h2 class="tab__title">Operations</h2>
      <p class="tab__subtitle">
        Every maintenance job the backend offers, with the inputs it asks for. Nothing is queued, so
        starting a job twice runs it twice.
      </p>
    </div>

    <p v-if="typesError" class="result result--err">{{ typesError }}</p>

    <JobRunner :types="jobTypes" :loading="typesLoading" :running-types="runningTypes"
      :submitting="submitting" :error="submitError" :notice="submitNotice" @submit="submitJob" />

    <JobsList :jobs="jobs" :labels="jobLabels" :loading="jobsLoading" :error="jobsError"
      @refresh="refreshJobs" />

    <div class="grid">
      <div class="op-card">
        <div class="op-card__head">
          <span class="op-card__title">Player Stats</span>
          <span class="scope scope--targeted">targeted</span>
        </div>
        <p class="op-card__desc">Recalculate statistics for a specific player in one category.</p>
        <ResourcePicker v-model="statsUserId" :search="userSource.search" :resolve="userSource.resolve"
          :placeholder="userSource.placeholder" />
        <div class="cat-row">
          <button v-for="cat in categoryStore.categories" :key="cat.id" class="cat-btn"
            :class="{ 'cat-btn--active': statsCategoryId === cat.id }" @click="statsCategoryId = cat.id">
            {{ cat.name }}
          </button>
        </div>
        <div class="op-card__foot">
          <BaseButton variant="primary" :loading="playerStats.loading"
            :disabled="!statsUserId || !statsCategoryId" @click="recalcPlayerStats">Run</BaseButton>
          <span v-if="playerStats.result" class="result"
            :class="playerStats.ok ? 'result--ok' : 'result--err'">{{ playerStats.result }}</span>
        </div>
      </div>

      <div class="op-card">
        <div class="op-card__head">
          <span class="op-card__title">Remove Score</span>
          <span class="scope scope--targeted">targeted</span>
        </div>
        <p class="op-card__desc">Remove a wrongly-attributed score. User will be re-fetched afterwards.</p>
        <ResourcePicker v-model="removeScoreUserId" :search="userSource.search" :resolve="userSource.resolve"
          :placeholder="userSource.placeholder" />
        <ResourcePicker v-model="removeScoreDiffId" :search="difficultySource.search"
          :resolve="difficultySource.resolve" :placeholder="difficultySource.placeholder" />
        <BaseInput v-model="removeScoreReason" placeholder="Reason (optional)" />
        <div class="op-card__foot">
          <BaseButton variant="destructive" :loading="removeScoreOp.loading"
            :disabled="!removeScoreUserId || !removeScoreDiffId" @click="removeScore">Remove</BaseButton>
          <span v-if="removeScoreOp.result" class="result"
            :class="removeScoreOp.ok ? 'result--ok' : 'result--err'">{{ removeScoreOp.result }}</span>
        </div>
      </div>

      <div class="op-card">
        <div class="op-card__head">
          <span class="op-card__title">Player Refresh</span>
          <span class="scope scope--targeted">targeted</span>
        </div>
        <p class="op-card__desc">Re-fetch player data from external sources.</p>
        <ResourcePicker v-model="refreshUserId" :search="userSource.search" :resolve="userSource.resolve"
          :placeholder="userSource.placeholder" />
        <div class="op-card__foot">
          <BaseButton :loading="playerRefresh.loading" :disabled="!refreshUserId" @click="refreshPlayer">
            Refresh Player
          </BaseButton>
          <BaseButton variant="destructive" :loading="refreshAllOp.loading" @click="refreshAll">
            Refresh All
          </BaseButton>
          <span v-if="playerRefresh.result" class="result"
            :class="playerRefresh.ok ? 'result--ok' : 'result--err'">{{ playerRefresh.result }}</span>
          <span v-if="refreshAllOp.result" class="result"
            :class="refreshAllOp.ok ? 'result--ok' : 'result--err'">{{ refreshAllOp.result }}</span>
        </div>
      </div>
    </div>

    <section class="ws-section">
      <div class="ws-section__header">
        <h3 class="ws-section__title">WebSocket Connections</h3>
        <BaseButton size="sm" :loading="wsLoading" @click="fetchWsStatus">Refresh Status</BaseButton>
      </div>
      <div class="ws-row">
        <div class="ws-card">
          <span class="ws-card__name">BeatLeader</span>
          <span v-if="wsStatus" class="ws-card__status">{{ JSON.stringify(wsStatus['beatleader'] ?? 'unknown') }}</span>
          <BaseButton size="sm" :loading="wsReconnecting['beatleader']" @click="reconnect('beatleader')">Reconnect</BaseButton>
        </div>
        <div class="ws-card">
          <span class="ws-card__name">ScoreSaber</span>
          <span v-if="wsStatus" class="ws-card__status">{{ JSON.stringify(wsStatus['scoresaber'] ?? 'unknown') }}</span>
          <BaseButton size="sm" :loading="wsReconnecting['scoresaber']" @click="reconnect('scoresaber')">Reconnect</BaseButton>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.tab { display: flex; flex-direction: column; gap: var(--space-lg); }

.tab__header { display: flex; flex-direction: column; gap: var(--space-xs); }
.tab__title { font-size: var(--text-section-heading); font-weight: 600; color: var(--text-primary); margin: 0; }
.tab__subtitle { font-size: var(--text-caption); color: var(--text-secondary); margin: 0; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--space-md); }

.op-card {
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.op-card__head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm); }
.op-card__title { font-size: var(--text-body); font-weight: 600; color: var(--text-primary); }
.op-card__desc { font-size: var(--text-caption); color: var(--text-secondary); margin: 0; line-height: 1.5; }
.op-card__foot { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; margin-top: auto; }

.scope {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 600;
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  border: 1px solid;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.scope--targeted { color: var(--info); border-color: color-mix(in srgb, var(--info) 30%, transparent); background: color-mix(in srgb, var(--info) 8%, transparent); }

.cat-row { display: flex; flex-wrap: wrap; gap: var(--space-xs); }
.cat-btn {
  padding: 3px 10px;
  background: none;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-pill);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 100ms;
}
.cat-btn:hover { border-color: var(--text-tertiary); color: var(--text-primary); }
.cat-btn--active { border-color: var(--accent); color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); }

.result { font-size: var(--text-caption); font-family: var(--font-mono); }
.result--ok { color: var(--success); }
.result--err { color: var(--error); }

.ws-section { display: flex; flex-direction: column; gap: var(--space-md); }
.ws-section__header { display: flex; align-items: center; justify-content: space-between; }
.ws-section__title { font-size: var(--text-body); font-weight: 600; color: var(--text-primary); margin: 0; }

.ws-row { display: flex; gap: var(--space-md); flex-wrap: wrap; }
.ws-card {
  flex: 1;
  min-width: 200px;
  display: flex;
  align-items: center;
  gap: var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  padding: var(--space-md);
}
.ws-card__name { font-size: var(--text-body); font-weight: 600; color: var(--text-primary); }
.ws-card__status { font-size: var(--text-caption); font-family: var(--font-mono); color: var(--text-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; }
</style>
