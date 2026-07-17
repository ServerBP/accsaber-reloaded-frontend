<script setup lang="ts">
import StatBlock from '@/components/common/StatBlock.vue'
import SkillLevelPanel from '@/components/domain/SkillLevelPanel.vue'
import TimeSeriesChart from '@/components/domain/TimeSeriesChart.vue'
import { useCategoryStore } from '@/stores/categories'
import { useThemeStore } from '@/stores/theme'
import type {
  RankingHistoryResponse,
  SkillResponse,
  UserAllStatisticsResponse,
  UserCategoryStatisticsResponse,
} from '@/types/api/users'
import type { CategoryCode, ChartSeries, MetricType, TimeRange, TimeSeriesPoint } from '@/types/display'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  userId: string
  category: CategoryCode
  xpStats?: UserAllStatisticsResponse | null
}>()

const METRICS_STORAGE_KEY = 'profile:stats:metrics'

const categoryStore = useCategoryStore()
const themeStore = useThemeStore()
const selectedMetrics = ref<MetricType[]>(loadSelectedMetrics())
const selectedRange = ref<TimeRange>('all')
const chartData = ref<UserCategoryStatisticsResponse[]>([])
const rankHistoryData = ref<RankingHistoryResponse[]>([])
const allTimeData = ref<UserCategoryStatisticsResponse[]>([])
const skill = ref<SkillResponse | null>(null)
const skillLoading = ref(false)

const timeRangeParams: Record<TimeRange, { amount: number; unit: 'h' | 'd' | 'mo' }> = {
  '24h': { amount: 24, unit: 'h' },
  '7d': { amount: 7, unit: 'd' },
  '14d': { amount: 14, unit: 'd' },
  '30d': { amount: 30, unit: 'd' },
  '90d': { amount: 90, unit: 'd' },
  '1y': { amount: 12, unit: 'mo' },
  'all': { amount: 120, unit: 'mo' },
}

const availableMetrics: { key: MetricType; label: string; colorVar: string; invertY?: boolean }[] = [
  { key: 'ap', label: 'AP', colorVar: '' },
  { key: 'avgAccuracy', label: 'Avg Accuracy', colorVar: '--success' },
  { key: 'rankedPlays', label: 'Ranked Plays', colorVar: '--info' },
  { key: 'rank', label: 'Rank', colorVar: '--warning', invertY: true },
]

function loadSelectedMetrics(): MetricType[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(METRICS_STORAGE_KEY) ?? '')
    if (Array.isArray(parsed)) {
      const valid = parsed.filter((m): m is MetricType =>
        availableMetrics.some((a) => a.key === m))
      if (valid.length) return valid
    }
  } catch {
    // fall through to default
  }
  return ['ap']
}

function metricPercent(metric: MetricType): boolean {
  return metric === 'avgAccuracy'
}

function metricColor(metric: MetricType): string {
  void themeStore.theme
  if (metric === 'ap') return chartAccent.value
  const colorVar = availableMetrics.find((m) => m.key === metric)?.colorVar
  const resolved = colorVar
    ? getComputedStyle(document.documentElement).getPropertyValue(colorVar).trim()
    : ''
  return resolved || chartAccent.value
}

function rawMetricPoints(metric: MetricType): TimeSeriesPoint[] {
  const source: TimeSeriesPoint[] = metric === 'rank'
    ? rankHistoryData.value.map((d) => ({ timestamp: new Date(d.recordedAt).getTime(), value: d.ranking }))
    : chartData.value.map((s) => ({ timestamp: new Date(s.createdAt).getTime(), value: getMetricValue(metric, s) }))
  return source.sort((a, b) => a.timestamp - b.timestamp)
}

function fillOntoTimeline(raw: TimeSeriesPoint[], timeline: number[]): TimeSeriesPoint[] {
  const out: TimeSeriesPoint[] = []
  let i = 0
  let last: number | null = null
  for (const ts of timeline) {
    while (i < raw.length && raw[i].timestamp <= ts) {
      last = raw[i].value
      i++
    }
    if (last !== null) out.push({ timestamp: ts, value: last })
  }
  return out
}

const chartSeries = computed<ChartSeries[]>(() => {
  const raws = selectedMetrics.value
    .map((metric) => ({ metric, raw: rawMetricPoints(metric) }))
    .filter((x) => x.raw.length > 0)
  if (raws.length === 0) return []

  const minTs = Math.min(...raws.map((x) => x.raw[0].timestamp))
  const span = Math.max(0, Date.now() - minTs)
  const bucketSize = Math.max(3600000, Math.floor(span / 150))
  const startBucket = Math.floor(minTs / bucketSize)
  const endBucket = Math.floor(Date.now() / bucketSize)
  const timeline: number[] = []
  for (let b = startBucket; b <= endBucket; b++) timeline.push(b * bucketSize)

  return raws.map(({ metric, raw }) => ({
    key: metric,
    label: availableMetrics.find((m) => m.key === metric)?.label ?? metric,
    points: fillOntoTimeline(raw, timeline),
    color: metricColor(metric),
    invertY: metric === 'rank',
    formatValue: metricPercent(metric) ? (v: number) => `${v.toFixed(2)}%` : undefined,
  }))
})

function toggleMetric(metric: MetricType): void {
  const active = new Set(selectedMetrics.value)
  if (active.has(metric)) {
    if (active.size === 1) return
    active.delete(metric)
  } else {
    active.add(metric)
  }
  selectedMetrics.value = availableMetrics.map((m) => m.key).filter((k) => active.has(k))
}

const peakStats = computed(() => {
  const data = allTimeData.value
  if (data.length === 0) return null

  let peakRank = Infinity
  let peakCountryRank = Infinity
  let peakAp = -Infinity

  for (const s of data) {
    if (s.ranking > 0 && s.ranking < peakRank) peakRank = s.ranking
    if (s.countryRanking > 0 && s.countryRanking < peakCountryRank) peakCountryRank = s.countryRanking
    if (s.ap > peakAp) peakAp = s.ap
  }

  return {
    peakRank: peakRank === Infinity ? null : peakRank,
    peakCountryRank: peakCountryRank === Infinity ? null : peakCountryRank,
    peakAp: peakAp === -Infinity ? null : peakAp,
  }
})

const chartAccent = computed(() => categoryStore.getAccent(props.category))
const xpAccent = computed(() => categoryStore.getAccent('xp'))

function getMetricValue(metric: MetricType, stat: UserCategoryStatisticsResponse): number {
  switch (metric) {
    case 'ap': return stat.ap
    case 'avgAccuracy': return stat.averageAcc * 100
    case 'rankedPlays': return stat.rankedPlays
    case 'rank': return stat.ranking
    default: return 0
  }
}

async function fetchChartData() {
  try {
    const { getUserHistoricStatistics } = await import('@/api/users')
    chartData.value = await getUserHistoricStatistics(props.userId, {
      category: props.category,
      ...timeRangeParams[selectedRange.value],
    })
  } catch {
    chartData.value = []
  }
}

async function fetchRankHistory() {
  try {
    const { getUserRankingHistory } = await import('@/api/users')
    rankHistoryData.value = await getUserRankingHistory(props.userId, {
      category: props.category,
      ...timeRangeParams[selectedRange.value],
    })
  } catch {
    rankHistoryData.value = []
  }
}

async function fetchAllTimeData() {
  try {
    const { getUserHistoricStatistics } = await import('@/api/users')
    allTimeData.value = await getUserHistoricStatistics(props.userId, {
      category: props.category,
      amount: 120,
      unit: 'mo',
    })
  } catch {
    allTimeData.value = []
  }
}

async function fetchSkill() {
  skillLoading.value = true
  try {
    const { getUserSkill } = await import('@/api/users')
    skill.value = await getUserSkill(props.userId)
  } catch {
    skill.value = null
  } finally {
    skillLoading.value = false
  }
}

watch(
  [() => props.userId, () => props.category, selectedRange],
  () => { fetchChartData() },
  { immediate: true },
)

watch(
  [() => props.userId, () => props.category, selectedRange, () => selectedMetrics.value.includes('rank')],
  () => {
    if (selectedMetrics.value.includes('rank')) fetchRankHistory()
  },
  { immediate: true },
)

watch(
  selectedMetrics,
  (metrics) => {
    try {
      localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(metrics))
    } catch {
      // storage unavailable; preference not persisted
    }
  },
  { deep: true },
)

watch(
  [() => props.userId, () => props.category],
  () => { fetchAllTimeData() },
  { immediate: true },
)

watch(
  () => props.userId,
  () => { fetchSkill() },
  { immediate: true },
)
</script>

<template>
  <div class="statistics-tab">
    <div class="statistics-tab__top-row">
      <section class="statistics-tab__chart">
        <h3 class="statistics-tab__section-title">History</h3>
        <div class="metric-toggles" role="group" aria-label="Chart metrics">
          <button v-for="metric in availableMetrics" :key="metric.key" type="button" class="metric-toggles__box"
            :class="{ 'metric-toggles__box--active': selectedMetrics.includes(metric.key) }"
            :aria-pressed="selectedMetrics.includes(metric.key)"
            :style="{ '--metric-color': metricColor(metric.key) }" @click="toggleMetric(metric.key)">
            <span class="metric-toggles__swatch" />
            {{ metric.label }}
          </button>
        </div>
        <TimeSeriesChart :series="chartSeries" :selected-range="selectedRange"
          @update:selected-range="selectedRange = $event" />
      </section>

      <section v-if="skill || skillLoading" class="statistics-tab__skill">
        <h3 class="statistics-tab__section-title">Skill Level</h3>
        <SkillLevelPanel :skill="skill" :loading="skillLoading" />
      </section>
    </div>

    <div v-if="peakStats || xpStats" class="statistics-tab__split">
      <section v-if="peakStats" class="statistics-tab__peaks">
        <h3 class="statistics-tab__section-title">Peak Stats</h3>
        <div class="statistics-tab__peaks-grid">
          <StatBlock v-if="peakStats.peakRank != null" label="Peak Global Rank" :value="peakStats.peakRank"
            :decimals="0" />
          <StatBlock v-if="peakStats.peakCountryRank != null" label="Peak Country Rank" :value="peakStats.peakCountryRank"
            :decimals="0" />
          <StatBlock v-if="peakStats.peakAp != null" label="Peak AP" :value="peakStats.peakAp" />
        </div>
      </section>

      <section v-if="xpStats" class="xp-breakdown">
        <h3 class="statistics-tab__section-title">XP Breakdown</h3>
        <StatBlock label="Total XP" :value="xpStats.totalXp" :decimals="0" :accent-color="xpAccent" />
        <div class="xp-breakdown__tree">
          <div class="xp-breakdown__drop" />
          <div class="xp-breakdown__drop" />
          <div class="xp-breakdown__drop" />
          <div class="xp-breakdown__drop" />
          <div class="xp-breakdown__drop" />
        </div>
        <div class="xp-breakdown__sources">
          <StatBlock label="Score XP" :value="xpStats.totalScoreXp" :decimals="0" />
          <StatBlock label="Milestone XP" :value="xpStats.totalMilestoneXp" :decimals="0" />
          <StatBlock label="Set Bonus XP" :value="xpStats.totalMilestoneSetBonusXp" :decimals="0" />
          <StatBlock label="Mission XP" :value="xpStats.totalMissionXp" :decimals="0" />
          <StatBlock label="Campaign XP" :value="xpStats.totalCampaignXp" :decimals="0" />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.statistics-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2xl);
}

.statistics-tab__section-title {
  font-size: var(--text-section-heading);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-md) 0;
  text-align: center;
}

.statistics-tab__split {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2xl);
  width: 100%;
}

.statistics-tab__peaks {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 800px;
}

.statistics-tab__peaks-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-sm);
}

.statistics-tab__top-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: var(--space-lg);
  width: 100%;
  align-self: stretch;
}

.statistics-tab__skill {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.xp-breakdown {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 800px;
}

.xp-breakdown__tree {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  width: 100%;
  height: 28px;
}

.xp-breakdown__drop {
  position: relative;
}

.xp-breakdown__drop::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  width: 1px;
  height: 100%;
  background: var(--text-tertiary);
}

.xp-breakdown__drop:first-child::before,
.xp-breakdown__drop:last-child::before {
  content: '';
  position: absolute;
  top: 0;
  height: 1px;
  background: var(--text-tertiary);
}

.xp-breakdown__drop:first-child::before {
  left: 50%;
  right: 0;
}

.xp-breakdown__drop:last-child::before {
  left: 0;
  right: 50%;
}

.xp-breakdown__drop:nth-child(2)::before,
.xp-breakdown__drop:nth-child(3)::before,
.xp-breakdown__drop:nth-child(4)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--text-tertiary);
}

.xp-breakdown__sources {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  width: 100%;
}

.xp-breakdown__sources :deep(.stat-block) {
  align-items: center;
}

.statistics-tab__chart {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-width: 0;
}

.metric-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.metric-toggles__box {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
}

.metric-toggles__box:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.metric-toggles__box--active {
  border-color: var(--metric-color);
  color: var(--text-primary);
}

.metric-toggles__swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid var(--metric-color);
  background: transparent;
  transition: background-color 120ms ease;
}

.metric-toggles__box--active .metric-toggles__swatch {
  background: var(--metric-color);
}

@media (min-width: 1024px) {
  .statistics-tab__split {
    flex-direction: row;
    align-items: flex-start;
    justify-content: center;
  }

  .statistics-tab__split .statistics-tab__peaks,
  .statistics-tab__split .xp-breakdown {
    flex: 1 1 0;
    min-width: 0;
  }
}

@media (max-width: 767px) {
  .statistics-tab__top-row {
    grid-template-columns: 1fr;
  }

  .statistics-tab__skill {
    justify-self: center;
  }

  .xp-breakdown__sources {
    grid-template-columns: 1fr;
  }

  .xp-breakdown__tree {
    display: none;
  }
}
</style>
