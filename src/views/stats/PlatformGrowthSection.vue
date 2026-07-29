<script setup lang="ts">
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import DistributionRanking from '@/components/domain/DistributionRanking.vue'
import TimeSeriesChart from '@/components/domain/TimeSeriesChart.vue'
import type { DistributionEntryResponse, TimeSeriesPointResponse } from '@/types/api/statistics'
import type { MetricType, TimeRange, TimeSeriesPoint } from '@/types/display'
import { TIME_RANGE_PARAMS } from '@/utils/constants'
import { countryName } from '@/utils/countries'
import { onMounted, ref } from 'vue'

defineProps<{ accent: string }>()

const GROWTH_METRICS: { key: MetricType; label: string }[] = [
  { key: 'newPlayers', label: 'New Players' },
  { key: 'totalPlayers', label: 'Total Players' },
  { key: 'dailyScores', label: 'Daily Scores' },
  { key: 'totalScores', label: 'Total Scores' },
]

const METRIC_ENDPOINTS = {
  newPlayers: 'getNewPlayersPerDay',
  totalPlayers: 'getCumulativeAccounts',
  dailyScores: 'getScoresPerDay',
  totalScores: 'getCumulativeScores',
} as const

const growthMetric = ref<MetricType>('newPlayers')
const growthRange = ref<TimeRange>('30d')
const growthChartData = ref<TimeSeriesPoint[]>([])
const growthLoading = ref(false)
const hmdData = ref<DistributionEntryResponse[]>([])
const countryData = ref<DistributionEntryResponse[]>([])
const categoryData = ref<DistributionEntryResponse[]>([])
const distributionsLoaded = ref(false)
const chartCache = ref<Record<string, TimeSeriesPointResponse[]>>({})

let chartRequestId = 0

function toChartPoints(data: TimeSeriesPointResponse[]): TimeSeriesPoint[] {
  return data.map((d) => ({ timestamp: new Date(d.date).getTime(), value: d.value }))
}

async function fetchChart(metric: MetricType, range: TimeRange) {
  const key = `${metric}:${range}`
  if (chartCache.value[key]) {
    growthChartData.value = toChartPoints(chartCache.value[key])
    growthLoading.value = false
    return
  }
  const requestId = ++chartRequestId
  growthLoading.value = true
  growthChartData.value = []
  try {
    const api = await import('@/api/statistics')
    const endpoint = METRIC_ENDPOINTS[metric as keyof typeof METRIC_ENDPOINTS]
    if (!endpoint) { growthChartData.value = []; return }
    const data = await api[endpoint](TIME_RANGE_PARAMS[range])
    if (requestId !== chartRequestId) return
    chartCache.value[key] = data
    growthChartData.value = toChartPoints(data)
  } catch (error) {
    if (requestId !== chartRequestId) return
    console.error('Failed to fetch chart:', error)
    growthChartData.value = []
  }
  growthLoading.value = false
}

async function fetchDistributions() {
  if (distributionsLoaded.value) return
  try {
    const api = await import('@/api/statistics')
    const [hmd, country, category] = await Promise.all([
      api.getPlayersByHmd(), api.getPlayersPerCountry(), api.getScoresPerCategory(),
    ])
    hmdData.value = hmd
    countryData.value = country.map((c) => ({ ...c, label: countryName(c.label) }))
    categoryData.value = category
    distributionsLoaded.value = true
  } catch (error) {
    console.error('Failed to fetch distributions:', error)
  }
}

function onMetricChange(m: MetricType) { growthMetric.value = m; fetchChart(m, growthRange.value) }
function onRangeChange(r: TimeRange) { growthRange.value = r; fetchChart(growthMetric.value, r) }

onMounted(() => {
  fetchChart(growthMetric.value, growthRange.value)
  fetchDistributions()
})
</script>

<template>
  <div class="growth">
    <div class="growth__chart">
      <TimeSeriesChart :data="growthChartData" metric-label="Platform Growth" :accent-color="accent"
        :available-metrics="GROWTH_METRICS" :selected-metric="growthMetric" :selected-range="growthRange"
        @update:selected-metric="onMetricChange" @update:selected-range="onRangeChange" />
      <div v-if="growthLoading" class="growth__chart-skeleton">
        <SkeletonLoader variant="card" height="300px" />
      </div>
    </div>
    <div class="growth__distributions">
      <DistributionRanking title="Top Headsets" :entries="hmdData" :accent-color="accent" />
      <DistributionRanking title="Top Countries" :entries="countryData" :accent-color="accent" />
      <DistributionRanking title="Scores by Category" :entries="categoryData" :accent-color="accent" />
    </div>
  </div>
</template>

<style scoped>
.growth {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.growth__chart {
  position: relative;
}

.growth__chart-skeleton {
  position: absolute;
  inset: 0;
}

.growth__distributions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
}

@media (max-width: 767px) {
  .growth__distributions {
    grid-template-columns: 1fr;
  }
}
</style>
