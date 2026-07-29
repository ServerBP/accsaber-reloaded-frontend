<script setup lang="ts">
import BaseTabs from '@/components/common/BaseTabs.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import { useThemeStore } from '@/stores/theme'
import type { ChartSeries, MetricType, TimeRange, TimeSeriesPoint } from '@/types/display'
import { DAY_MS, HOUR_MS, rangeWindowStart } from '@/utils/constants'
import { computed, nextTick, onUnmounted, ref, shallowRef, watch } from 'vue'

const props = defineProps<{
  data?: TimeSeriesPoint[]
  metricLabel?: string
  accentColor?: string
  series?: ChartSeries[]
  availableMetrics?: { key: MetricType; label: string }[]
  selectedMetric?: MetricType
  selectedRange?: TimeRange
  invertY?: boolean
  formatValue?: (v: number) => string
  yMax?: number
  yMin?: number
}>()

interface ResolvedSeries {
  label: string
  points: TimeSeriesPoint[]
  color: string
  invertY: boolean
  formatValue?: (v: number) => string
}

const resolvedSeries = computed<ResolvedSeries[]>(() =>
  props.series?.length
    ? props.series.map((s) => ({
      label: s.label,
      points: s.points,
      color: s.color,
      invertY: !!s.invertY,
      formatValue: s.formatValue,
    }))
    : [{
      label: props.metricLabel ?? '',
      points: props.data ?? [],
      color: props.accentColor ?? '',
      invertY: !!props.invertY,
      formatValue: props.formatValue,
    }],
)

const emit = defineEmits<{
  'update:selectedMetric': [value: MetricType]
  'update:selectedRange': [value: TimeRange]
}>()

const themeStore = useThemeStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const isLoading = ref(true)
const chartInstance = shallowRef<unknown>(null)

const timeRanges: { key: TimeRange; label: string }[] = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '14d', label: '2w' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: '1y', label: '1y' },
  { key: 'all', label: 'All' },
]

const activeRange = computed(() => props.selectedRange ?? '30d')

const hasData = computed(() => resolvedSeries.value.some((s) => s.points.length > 0))

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return `${value}`
  return Number.isInteger(value) ? `${value}` : value.toFixed(2)
}

function timeDomain(series: ResolvedSeries[], range: TimeRange, now: number) {
  let dataMin = now
  let dataMax = now
  for (const s of series) {
    for (const p of s.points) {
      if (p.timestamp < dataMin) dataMin = p.timestamp
      if (p.timestamp > dataMax) dataMax = p.timestamp
    }
  }
  const min = rangeWindowStart(range, dataMin, now)
  const max = Math.max(now, dataMax)
  return max - min < HOUR_MS ? { min: max - HOUR_MS, max } : { min, max }
}

async function loadChart() {
  isLoading.value = true
  try {
    const { Chart, LineController, LineElement, PointElement, LinearScale, Filler, Tooltip } = await import('chart.js')
    Chart.register(LineController, LineElement, PointElement, LinearScale, Filler, Tooltip)

    await nextTick()
    if (!canvasRef.value) return

    destroyChart()

    const styles = getComputedStyle(document.documentElement)
    const gridColor = styles.getPropertyValue('--chart-grid').trim() || 'rgba(255,255,255,0.06)'
    const textColor = styles.getPropertyValue('--chart-text').trim() || '#8888a0'
    const resolvedAccent = styles.getPropertyValue('--accent').trim() || '#f5b800'

    const series = resolvedSeries.value
    const isMulti = series.length > 1
    const domain = timeDomain(series, activeRange.value, Date.now())
    const spanMs = domain.max - domain.min

    const formatTick = (ts: number): string => {
      const d = new Date(ts)
      if (spanMs <= 36 * HOUR_MS) {
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      }
      if (spanMs <= 14 * DAY_MS) {
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      }
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
    }

    const formatTooltipTitle = (ts: number): string => {
      const d = new Date(ts)
      const date = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
      if (spanMs > 14 * DAY_MS) return date
      return `${date}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
    }

    const prepared = series.map((s, idx) => {
      const pointMap = new Map<number, TimeSeriesPoint>()
      for (const p of s.points) pointMap.set(p.timestamp, p)
      return {
        ...s,
        idx,
        pointMap,
        color: s.color || resolvedAccent,
        axisId: isMulti ? `y${idx}` : 'y',
      }
    })

    const yScales = Object.fromEntries(prepared.map((s) => [s.axisId, {
      reverse: s.invertY,
      position: !isMulti || s.idx === 0 ? 'left' : 'right',
      display: !isMulti || s.idx < 2,
      max: isMulti ? undefined : props.yMax,
      min: isMulti ? undefined : props.yMin,
      grid: { color: gridColor, drawOnChartArea: s.idx === 0 },
      ticks: {
        color: isMulti ? s.color : textColor,
        font: { family: 'JetBrains Mono, monospace', size: 10 },
        callback: (value: number | string) =>
          s.formatValue ? s.formatValue(value as number) : formatNumber(value as number),
      },
    }]))

    chartInstance.value = new Chart(canvasRef.value, {
      type: 'line',
      data: {
        datasets: prepared.map((s) => ({
          label: s.label,
          data: s.points.map((p) => ({ x: p.timestamp, y: p.value })),
          borderColor: s.color,
          backgroundColor: `color-mix(in srgb, ${s.color} 10%, transparent)`,
          fill: isMulti ? false : s.invertY ? 'start' : true,
          yAxisID: s.axisId,
          spanGaps: true,
          tension: 0.3,
          pointRadius: s.points.length < 50 ? 3 : 0,
          pointHoverRadius: 5,
          borderWidth: 2,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300,
        },
        interaction: {
          mode: 'index',
          axis: 'x',
          intersect: false,
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => {
                const ts = items[0]?.parsed?.x
                return ts != null ? formatTooltipTitle(ts) : ''
              },
              label: (item) => {
                const s = prepared[item.datasetIndex]
                const point = item.parsed.x != null ? s?.pointMap.get(item.parsed.x) : undefined
                if (point?.tooltipLines?.length) {
                  return point.tooltipLines
                }
                const y = item.parsed.y ?? 0
                const val = s?.formatValue ? s.formatValue(y) : formatNumber(y)
                return isMulti ? `${s?.label}: ${val}` : val
              },
              afterLabel: () => '',
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            min: domain.min,
            max: domain.max,
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: 'JetBrains Mono, monospace', size: 10 },
              maxTicksLimit: 8,
              maxRotation: 0,
              autoSkip: true,
              callback: (value: number | string) => formatTick(value as number),
            },
          },
          ...yScales,
        },
      },
    })
  } catch {
  }
  isLoading.value = false
}

function destroyChart() {
  if (chartInstance.value && typeof (chartInstance.value as { destroy: () => void }).destroy === 'function') {
    (chartInstance.value as { destroy: () => void }).destroy()
    chartInstance.value = null
  }
}

watch([
  () => props.data,
  () => props.series,
  () => props.accentColor,
  () => props.selectedRange,
  () => themeStore.theme,
], () => {
  loadChart()
}, { immediate: true })

onUnmounted(() => {
  destroyChart()
})
</script>

<template>
  <div class="chart-container">
    <div v-if="availableMetrics?.length" class="chart-container__controls">
      <BaseTabs v-if="availableMetrics && selectedMetric"
        :tabs="availableMetrics.map((m) => ({ key: m.key, label: m.label }))" :model-value="selectedMetric"
        @update:model-value="emit('update:selectedMetric', $event as MetricType)" />
    </div>
    <div class="chart-container__range">
      <button v-for="range in timeRanges" :key="range.key" class="chart-container__range-btn"
        :class="{ 'chart-container__range-btn--active': activeRange === range.key }"
        @click="emit('update:selectedRange', range.key)">
        {{ range.label }}
      </button>
    </div>
    <div class="chart-container__canvas-wrap">
      <SkeletonLoader v-if="isLoading" variant="card" height="240px" />
      <div v-else-if="!hasData" class="chart-container__empty">
        No scores could be found with the timeframe selected.
      </div>
      <canvas v-show="!isLoading && hasData" ref="canvasRef" />
    </div>
  </div>
</template>

<style scoped>
.chart-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.chart-container__controls {
  display: flex;
  gap: var(--space-sm);
}

.chart-container__range {
  display: flex;
  gap: var(--space-xs);
}

.chart-container__range-btn {
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

.chart-container__range-btn:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.chart-container__range-btn--active {
  border-color: var(--accent);
  color: var(--accent);
}

.chart-container__canvas-wrap {
  position: relative;
  height: 240px;
}

.chart-container__canvas-wrap canvas {
  width: 100% !important;
  height: 100% !important;
}

.chart-container__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  font-size: var(--text-body);
}
</style>
