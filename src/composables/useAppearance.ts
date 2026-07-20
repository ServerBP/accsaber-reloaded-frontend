import { useSettingsStore } from '@/stores/settings'
import type { ComplexityNumberStyle, ReplayService, ScoreRowField } from '@/types/api/settings'
import { sanitizeScoreRowFields } from '@/utils/scoreRowFields'
import { computed, type ComputedRef } from 'vue'

export interface AppearancePreferences {
  primaryReplayService: ComputedRef<ReplayService>
  fallbackReplayService: ComputedRef<ReplayService | null>
  complexityNumberStyle: ComputedRef<ComplexityNumberStyle>
  complexityBar: ComputedRef<boolean>
  scoreRowFields: ComputedRef<ScoreRowField[]>
  isScoreFieldVisible: (field: ScoreRowField) => boolean
  hideReloadedProfileFeatures: ComputedRef<boolean>
  showStatisticsChart: ComputedRef<boolean>
}

export function useAppearance(): AppearancePreferences {
  const settingsStore = useSettingsStore()
  const appearance = computed(() => settingsStore.appearance)

  const primaryReplayService = computed(
    () => appearance.value['appearance.primaryReplayService'],
  )

  const fallbackReplayService = computed(() => {
    const fallback = appearance.value['appearance.fallbackReplayService']
    return fallback && fallback !== primaryReplayService.value ? fallback : null
  })

  const scoreRowFields = computed(() =>
    sanitizeScoreRowFields(appearance.value['appearance.scoreRowFields']),
  )

  const visibleFields = computed(() => new Set(scoreRowFields.value))

  return {
    primaryReplayService,
    fallbackReplayService,
    complexityNumberStyle: computed(() => appearance.value['appearance.complexityNumberStyle']),
    complexityBar: computed(() => appearance.value['appearance.complexityBar']),
    scoreRowFields,
    isScoreFieldVisible: (field: ScoreRowField) => visibleFields.value.has(field),
    hideReloadedProfileFeatures: computed(
      () => appearance.value['appearance.hideReloadedProfileFeatures'],
    ),
    showStatisticsChart: computed(() => appearance.value['appearance.showStatisticsChart']),
  }
}
