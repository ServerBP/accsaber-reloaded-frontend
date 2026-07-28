<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import { parseApiError } from '@/api/client'
import type { JobResponse } from '@/types/api/jobs'
import { useCategoryStore } from '@/stores/categories'

const categoryStore = useCategoryStore()

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

async function runJobOp(op: OpState, fn: () => Promise<JobResponse>, label: string) {
  op.loading = true
  op.result = null
  try {
    const job = await fn()
    op.ok = true
    op.result = `${label} started (job ${job.id.slice(0, 8)}).`
    void refreshJobs()
  } catch (err) {
    op.ok = false
    op.result = describeFailure(err)
  } finally {
    op.loading = false
  }
}

const apByDiff = ref(makeOp())
const apDiffId = ref('')

const apRaw = ref(makeOp())
const apWeighted = ref(makeOp())
const apAll = ref(makeOp())

async function recalcApByDifficulty() {
  if (!apDiffId.value) return
  const id = apDiffId.value
  await runJobOp(apByDiff.value, async () => {
    const { recalculateApByDifficulty } = await import('@/api/admin/recalculation')
    const job = await recalculateApByDifficulty(id)
    apDiffId.value = ''
    return job
  }, 'AP recalculation')
}

async function recalcRawAp() {
  await runJobOp(apRaw.value, async () => {
    const { recalculateRawAp } = await import('@/api/admin/recalculation')
    return recalculateRawAp()
  }, 'Raw AP recalculation')
}

async function recalcWeightedAp() {
  await runJobOp(apWeighted.value, async () => {
    const { recalculateWeightedAp } = await import('@/api/admin/recalculation')
    return recalculateWeightedAp()
  }, 'Weighted AP recalculation')
}

async function recalcAllAp() {
  if (!confirm('Recalculate ALL AP (raw + weighted)? This is heavy.')) return
  await runJobOp(apAll.value, async () => {
    const { recalculateAllAp } = await import('@/api/admin/recalculation')
    return recalculateAllAp()
  }, 'Full AP recalculation')
}

const xpScores = ref(makeOp())
const xpSums = ref(makeOp())

async function recalcScoreXp() {
  if (!confirm('Reweight XP for all scores?')) return
  await runJobOp(xpScores.value, async () => {
    const { recalculateScoreXp } = await import('@/api/admin/recalculation')
    return recalculateScoreXp()
  }, 'Score XP reweight')
}

async function recalcXpSums() {
  if (!confirm('Recalculate XP sums for all users?')) return
  await runJobOp(xpSums.value, async () => {
    const { recalculateXpSums } = await import('@/api/admin/recalculation')
    return recalculateXpSums()
  }, 'XP total recalculation')
}

const playerStats = ref(makeOp())
const statsUserId = ref('')
const statsCategoryId = ref('')

async function recalcPlayerStats() {
  if (!statsUserId.value || !statsCategoryId.value) return
  run(playerStats.value, async () => {
    const { recalculatePlayerStats } = await import('@/api/admin/recalculation')
    await recalculatePlayerStats(statsUserId.value, statsCategoryId.value)
    statsUserId.value = ''
  }, 'Player stats recalculated.')
}
const backfill = ref(makeOp())
const backfillDiffId = ref('')

async function backfillScores() {
  const id = backfillDiffId.value.trim()
  if (!id && !confirm('Backfill ALL scores? This is very heavy.')) return
  await runJobOp(backfill.value, async () => {
    const mod = await import('@/api/admin/recalculation')
    if (!id) return mod.backfillAllScores()
    const job = await mod.backfillScoresByDifficulty(id)
    backfillDiffId.value = ''
    return job
  }, id ? 'Difficulty score backfill' : 'Full score backfill')
}

const userBackfill = ref(makeOp())
const userBackfillIds = ref('')

async function backfillUserScores() {
  const raw = userBackfillIds.value.trim()
  if (!raw) return
  const ids = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
  if (!ids.length) return
  await runJobOp(userBackfill.value, async () => {
    const mod = await import('@/api/admin/recalculation')
    const job =
      ids.length === 1
        ? await mod.backfillScoresByUser(ids[0])
        : await mod.backfillScoresByUsers(ids)
    userBackfillIds.value = ''
    return job
  }, `Score backfill for ${ids.length} user${ids.length === 1 ? '' : 's'}`)
}

const removeScoreOp = ref(makeOp())
const removeScoreUserId = ref('')
const removeScoreDiffId = ref('')
const removeScoreReason = ref('')

async function removeScore() {
  if (!removeScoreUserId.value || !removeScoreDiffId.value) return
  if (!confirm('Remove this score? The user will be re-fetched to avoid re-importing it.')) return
  run(removeScoreOp.value, async () => {
    const { removeScore: api } = await import('@/api/admin/recalculation')
    await api({
      userId: removeScoreUserId.value,
      mapDifficultyId: removeScoreDiffId.value,
      reason: removeScoreReason.value || undefined,
    })
    removeScoreUserId.value = ''
    removeScoreDiffId.value = ''
    removeScoreReason.value = ''
  }, 'Score removal queued.')
}

const milestoneBackfillAll = ref(makeOp())

async function backfillAllMilestonesOp() {
  if (!confirm('Backfill every active milestone for all users? This is very heavy.')) return
  await runJobOp(milestoneBackfillAll.value, async () => {
    const { backfillAllMilestones } = await import('@/api/admin/milestones')
    return backfillAllMilestones()
  }, 'Milestone backfill')
}

const cdnCovers = ref(makeOp())
const cdnAvatars = ref(makeOp())
const songSuggest = ref(makeOp())

async function backfillCovers() {
  await runJobOp(cdnCovers.value, async () => {
    const { backfillCdnMapCovers } = await import('@/api/admin/recalculation')
    return backfillCdnMapCovers()
  }, 'Map cover mirror')
}

async function backfillAvatars() {
  await runJobOp(cdnAvatars.value, async () => {
    const { backfillCdnAvatars } = await import('@/api/admin/recalculation')
    return backfillCdnAvatars()
  }, 'Avatar mirror')
}

async function regenerateSongSuggestOp() {
  await runJobOp(songSuggest.value, async () => {
    const { regenerateSongSuggest } = await import('@/api/admin/recalculation')
    return regenerateSongSuggest()
  }, 'SongSuggest regeneration')
}

const playerRefresh = ref(makeOp())
const refreshUserId = ref('')
const refreshAllOp = ref(makeOp())

async function refreshPlayer() {
  if (!refreshUserId.value) return
  run(playerRefresh.value, async () => {
    const { refreshPlayer: api } = await import('@/api/admin/recalculation')
    await api(refreshUserId.value)
    refreshUserId.value = ''
  }, 'Player refresh queued.')
}

async function refreshAll() {
  if (!confirm('Refresh ALL players? This is a heavy background job.')) return
  run(refreshAllOp.value, async () => {
    const { refreshAllPlayers } = await import('@/api/admin/recalculation')
    await refreshAllPlayers()
  }, 'All-player refresh queued.')
}

const jobs = ref<JobResponse[]>([])
const jobsLoading = ref(false)
const jobsError = ref<string | null>(null)
let jobPoll: ReturnType<typeof setTimeout> | null = null

const RUNNING_POLL_MS = 4000

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

function scheduleJobPoll() {
  if (jobPoll) clearTimeout(jobPoll)
  jobPoll = null
  if (!jobs.value.some((j) => j.status === 'RUNNING')) return
  jobPoll = setTimeout(() => {
    void refreshJobs()
  }, RUNNING_POLL_MS)
}

function jobDuration(job: JobResponse): string {
  const end = job.finishedAt ? Date.parse(job.finishedAt) : Date.now()
  const seconds = Math.max(0, Math.round((end - Date.parse(job.startedAt)) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

void refreshJobs()

onUnmounted(() => {
  if (jobPoll) clearTimeout(jobPoll)
})

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
      <p class="tab__subtitle">Heavy operations run as background jobs. Track them below.</p>
    </div>

    <section class="jobs">
      <div class="jobs__header">
        <h3 class="jobs__title">Jobs</h3>
        <BaseButton size="sm" :loading="jobsLoading" @click="refreshJobs">Refresh</BaseButton>
      </div>
      <p v-if="jobsError" class="result result--err">{{ jobsError }}</p>
      <p v-else-if="jobs.length === 0" class="jobs__empty">No jobs have run since the last restart.</p>
      <ul v-else class="jobs__list">
        <li v-for="job in jobs" :key="job.id" class="job" :class="`job--${job.status.toLowerCase()}`">
          <span class="job__type">{{ job.type }}</span>
          <span class="job__status">{{ job.status }}</span>
          <span class="job__detail">{{ job.detail || '-' }}</span>
          <span class="job__duration">{{ jobDuration(job) }}</span>
          <span v-if="job.error" class="job__error">{{ job.error }}</span>
        </li>
      </ul>
    </section>

    <div class="grid">
      <div class="op-card">
        <div class="op-card__head">
          <span class="op-card__title">AP by Difficulty</span>
          <span class="scope scope--targeted">targeted</span>
        </div>
        <p class="op-card__desc">Recalculate AP for all scores on a specific difficulty. Use after complexity changes.</p>
        <BaseInput v-model="apDiffId" placeholder="Difficulty UUID" />
        <div class="op-card__foot">
          <BaseButton variant="primary" :loading="apByDiff.loading" :disabled="!apDiffId" @click="recalcApByDifficulty">Run</BaseButton>
          <span v-if="apByDiff.result" class="result" :class="apByDiff.ok ? 'result--ok' : 'result--err'">{{ apByDiff.result }}</span>
        </div>
      </div>

      <div class="op-card">
        <div class="op-card__head">
          <span class="op-card__title">Player Stats</span>
          <span class="scope scope--targeted">targeted</span>
        </div>
        <p class="op-card__desc">Recalculate statistics for a specific player in one category.</p>
        <BaseInput v-model="statsUserId" placeholder="User ID" />
        <div class="cat-row">
          <button
            v-for="cat in categoryStore.categories" :key="cat.id"
            class="cat-btn" :class="{ 'cat-btn--active': statsCategoryId === cat.id }"
            @click="statsCategoryId = cat.id"
          >{{ cat.name }}</button>
        </div>
        <div class="op-card__foot">
          <BaseButton variant="primary" :loading="playerStats.loading" :disabled="!statsUserId || !statsCategoryId" @click="recalcPlayerStats">Run</BaseButton>
          <span v-if="playerStats.result" class="result" :class="playerStats.ok ? 'result--ok' : 'result--err'">{{ playerStats.result }}</span>
        </div>
      </div>

      <div class="op-card">
        <div class="op-card__head">
          <span class="op-card__title">Score Backfill</span>
          <span class="scope scope--broad">broad</span>
        </div>
        <p class="op-card__desc">Re-fetch scores from BeatLeader/ScoreSaber. Leave blank to backfill everything.</p>
        <BaseInput v-model="backfillDiffId" placeholder="Difficulty UUID (optional)" />
        <div class="op-card__foot">
          <BaseButton variant="primary" :loading="backfill.loading" @click="backfillScores">
            {{ backfillDiffId ? 'Backfill Difficulty' : 'Backfill All' }}
          </BaseButton>
          <span v-if="backfill.result" class="result" :class="backfill.ok ? 'result--ok' : 'result--err'">{{ backfill.result }}</span>
        </div>
      </div>

      <div class="op-card">
        <div class="op-card__head">
          <span class="op-card__title">Player Refresh</span>
          <span class="scope scope--targeted">targeted</span>
        </div>
        <p class="op-card__desc">Re-fetch player data from external sources.</p>
        <BaseInput v-model="refreshUserId" placeholder="User ID" />
        <div class="op-card__foot">
          <BaseButton :loading="playerRefresh.loading" :disabled="!refreshUserId" @click="refreshPlayer">Refresh Player</BaseButton>
          <BaseButton variant="destructive" :loading="refreshAllOp.loading" @click="refreshAll">Refresh All</BaseButton>
          <span v-if="playerRefresh.result" class="result" :class="playerRefresh.ok ? 'result--ok' : 'result--err'">{{ playerRefresh.result }}</span>
          <span v-if="refreshAllOp.result" class="result" :class="refreshAllOp.ok ? 'result--ok' : 'result--err'">{{ refreshAllOp.result }}</span>
        </div>
      </div>

      <div class="op-card">
        <div class="op-card__head">
          <span class="op-card__title">Backfill User Scores</span>
          <span class="scope scope--targeted">targeted</span>
        </div>
        <p class="op-card__desc">Re-fetch all BeatLeader scores for one or more users. Comma or newline separated IDs.</p>
        <textarea v-model="userBackfillIds" class="ids-input" placeholder="User IDs..." rows="2" spellcheck="false" />
        <div class="op-card__foot">
          <BaseButton variant="primary" :loading="userBackfill.loading" :disabled="!userBackfillIds.trim()" @click="backfillUserScores">Run</BaseButton>
          <span v-if="userBackfill.result" class="result" :class="userBackfill.ok ? 'result--ok' : 'result--err'">{{ userBackfill.result }}</span>
        </div>
      </div>

      <div class="op-card">
        <div class="op-card__head">
          <span class="op-card__title">Remove Score</span>
          <span class="scope scope--targeted">targeted</span>
        </div>
        <p class="op-card__desc">Remove a wrongly-attributed score. User will be re-fetched afterwards.</p>
        <BaseInput v-model="removeScoreUserId" placeholder="User ID" />
        <BaseInput v-model="removeScoreDiffId" placeholder="Map Difficulty UUID" />
        <BaseInput v-model="removeScoreReason" placeholder="Reason (optional)" />
        <div class="op-card__foot">
          <BaseButton variant="destructive" :loading="removeScoreOp.loading" :disabled="!removeScoreUserId || !removeScoreDiffId" @click="removeScore">Remove</BaseButton>
          <span v-if="removeScoreOp.result" class="result" :class="removeScoreOp.ok ? 'result--ok' : 'result--err'">{{ removeScoreOp.result }}</span>
        </div>
      </div>

      <div class="op-card op-card--warn">
        <div class="op-card__head">
          <span class="op-card__title">Backfill All Milestones</span>
          <span class="scope scope--global">global</span>
        </div>
        <p class="op-card__desc">Re-evaluate every active milestone for every user. Very heavy.</p>
        <div class="op-card__foot">
          <BaseButton variant="destructive" :loading="milestoneBackfillAll.loading" @click="backfillAllMilestonesOp">Run</BaseButton>
          <span v-if="milestoneBackfillAll.result" class="result" :class="milestoneBackfillAll.ok ? 'result--ok' : 'result--err'">{{ milestoneBackfillAll.result }}</span>
        </div>
      </div>

      <div class="op-card">
        <div class="op-card__head">
          <span class="op-card__title">Mirror Map Covers</span>
          <span class="scope scope--broad">broad</span>
        </div>
        <p class="op-card__desc">Copy missing map cover art onto the CDN.</p>
        <div class="op-card__foot">
          <BaseButton :loading="cdnCovers.loading" @click="backfillCovers">Run</BaseButton>
          <span v-if="cdnCovers.result" class="result" :class="cdnCovers.ok ? 'result--ok' : 'result--err'">{{ cdnCovers.result }}</span>
        </div>
      </div>

      <div class="op-card">
        <div class="op-card__head">
          <span class="op-card__title">Mirror Avatars</span>
          <span class="scope scope--broad">broad</span>
        </div>
        <p class="op-card__desc">Copy missing player avatars onto the CDN.</p>
        <div class="op-card__foot">
          <BaseButton :loading="cdnAvatars.loading" @click="backfillAvatars">Run</BaseButton>
          <span v-if="cdnAvatars.result" class="result" :class="cdnAvatars.ok ? 'result--ok' : 'result--err'">{{ cdnAvatars.result }}</span>
        </div>
      </div>

      <div class="op-card">
        <div class="op-card__head">
          <span class="op-card__title">SongSuggest Data</span>
          <span class="scope scope--broad">broad</span>
        </div>
        <p class="op-card__desc">Regenerate the SongSuggest export from current ranked data.</p>
        <div class="op-card__foot">
          <BaseButton :loading="songSuggest.loading" @click="regenerateSongSuggestOp">Run</BaseButton>
          <span v-if="songSuggest.result" class="result" :class="songSuggest.ok ? 'result--ok' : 'result--err'">{{ songSuggest.result }}</span>
        </div>
      </div>

      <div class="op-card">
        <div class="op-card__head">
          <span class="op-card__title">Raw AP</span>
          <span class="scope scope--broad">broad</span>
        </div>
        <p class="op-card__desc">Recalculate raw AP for all scores using current score curves.</p>
        <div class="op-card__foot">
          <BaseButton variant="primary" :loading="apRaw.loading" @click="recalcRawAp">Run</BaseButton>
          <span v-if="apRaw.result" class="result" :class="apRaw.ok ? 'result--ok' : 'result--err'">{{ apRaw.result }}</span>
        </div>
      </div>

      <div class="op-card">
        <div class="op-card__head">
          <span class="op-card__title">Weighted AP</span>
          <span class="scope scope--broad">broad</span>
        </div>
        <p class="op-card__desc">Recalculate weighted AP for all players using current weight curves.</p>
        <div class="op-card__foot">
          <BaseButton variant="primary" :loading="apWeighted.loading" @click="recalcWeightedAp">Run</BaseButton>
          <span v-if="apWeighted.result" class="result" :class="apWeighted.ok ? 'result--ok' : 'result--err'">{{ apWeighted.result }}</span>
        </div>
      </div>

      <div class="op-card op-card--warn">
        <div class="op-card__head">
          <span class="op-card__title">All AP (Raw + Weighted)</span>
          <span class="scope scope--global">global</span>
        </div>
        <p class="op-card__desc">Full AP recalculation across all scores and players.</p>
        <div class="op-card__foot">
          <BaseButton variant="destructive" :loading="apAll.loading" @click="recalcAllAp">Run</BaseButton>
          <span v-if="apAll.result" class="result" :class="apAll.ok ? 'result--ok' : 'result--err'">{{ apAll.result }}</span>
        </div>
      </div>

      <div class="op-card op-card--warn">
        <div class="op-card__head">
          <span class="op-card__title">Score XP Reweight</span>
          <span class="scope scope--global">global</span>
        </div>
        <p class="op-card__desc">Reweight XP for all scores. Run after XP formula changes.</p>
        <div class="op-card__foot">
          <BaseButton variant="destructive" :loading="xpScores.loading" @click="recalcScoreXp">Run</BaseButton>
          <span v-if="xpScores.result" class="result" :class="xpScores.ok ? 'result--ok' : 'result--err'">{{ xpScores.result }}</span>
        </div>
      </div>

      <div class="op-card op-card--warn">
        <div class="op-card__head">
          <span class="op-card__title">XP Sum Recalculation</span>
          <span class="scope scope--global">global</span>
        </div>
        <p class="op-card__desc">Recalculate total XP for all users. Run after score XP reweight.</p>
        <div class="op-card__foot">
          <BaseButton variant="destructive" :loading="xpSums.loading" @click="recalcXpSums">Run</BaseButton>
          <span v-if="xpSums.result" class="result" :class="xpSums.ok ? 'result--ok' : 'result--err'">{{ xpSums.result }}</span>
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

.jobs { display: flex; flex-direction: column; gap: var(--space-md); }
.jobs__header { display: flex; align-items: center; justify-content: space-between; }
.jobs__title { font-size: var(--text-body); font-weight: 600; color: var(--text-primary); margin: 0; }
.jobs__empty { font-size: var(--text-caption); color: var(--text-secondary); margin: 0; }
.jobs__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px; }

.job {
  display: grid;
  grid-template-columns: minmax(0, 2fr) 92px minmax(0, 3fr) 64px;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  font-size: var(--text-caption);
}
.job--running { border-color: color-mix(in srgb, var(--info) 35%, var(--bg-overlay)); }
.job--failed { border-color: color-mix(in srgb, var(--error) 35%, var(--bg-overlay)); }

.job__type { font-family: var(--font-mono); color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; }
.job__status { font-family: var(--font-mono); font-weight: 600; color: var(--text-secondary); }
.job--running .job__status { color: var(--info); }
.job--succeeded .job__status { color: var(--success); }
.job--failed .job__status { color: var(--error); }
.job__detail { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.job__duration { font-family: var(--font-mono); color: var(--text-tertiary); text-align: right; }
.job__error { grid-column: 1 / -1; color: var(--error); font-family: var(--font-mono); overflow-wrap: anywhere; }

@media (max-width: 768px) {
  .job { grid-template-columns: minmax(0, 1fr) auto; }
  .job__detail, .job__duration { grid-column: 1 / -1; text-align: left; }
}

.op-card {
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
.op-card--warn { border-color: color-mix(in srgb, var(--error) 20%, var(--bg-overlay)); }

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
.scope--broad { color: var(--warning); border-color: color-mix(in srgb, var(--warning) 30%, transparent); background: color-mix(in srgb, var(--warning) 8%, transparent); }
.scope--global { color: var(--error); border-color: color-mix(in srgb, var(--error) 30%, transparent); background: color-mix(in srgb, var(--error) 8%, transparent); }

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

.ids-input {
  padding: var(--space-sm);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  width: 100%;
  resize: vertical;
}
.ids-input:focus { border-color: var(--accent); outline: none; }
</style>
