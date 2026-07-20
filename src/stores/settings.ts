import {
  getMySettingsGroup as apiGetGroup,
  patchMySettingsGroup as apiPatchGroup,
} from '@/api/settings'
import type {
  AppearanceSettings,
  PrivacySettings,
  SettingGroup,
  SettingsBag,
  Visibility,
} from '@/types/api/settings'
import { DEFAULT_SCORE_ROW_FIELDS } from '@/utils/scoreRowFields'
import { defineStore } from 'pinia'
import { ref } from 'vue'

const PRIVACY_DEFAULTS: PrivacySettings = {
  'privacy.followingVisibility': 'public',
  'privacy.rivalsVisibility': 'public',
}

const APPEARANCE_DEFAULTS: AppearanceSettings = {
  'appearance.theme': '',
  'appearance.colorScheme': '',
  'appearance.primaryReplayService': 'beatleader',
  'appearance.fallbackReplayService': null,
  'appearance.complexityNumberStyle': 'colored',
  'appearance.complexityBar': true,
  'appearance.scoreRowFields': [...DEFAULT_SCORE_ROW_FIELDS],
  'appearance.hideReloadedProfileFeatures': false,
  'appearance.showStatisticsChart': false,
}

export const useSettingsStore = defineStore('settings', () => {
  const privacy = ref<PrivacySettings>({ ...PRIVACY_DEFAULTS })
  const privacyLoaded = ref(false)
  const privacySaving = ref(false)
  const privacyError = ref<string | null>(null)

  const appearance = ref<AppearanceSettings>({ ...APPEARANCE_DEFAULTS })
  const appearanceLoaded = ref(false)
  const appearanceSaving = ref(false)
  const appearanceError = ref<string | null>(null)

  async function fetchPrivacy(): Promise<void> {
    try {
      const res = await apiGetGroup<PrivacySettings>('privacy')
      privacy.value = { ...PRIVACY_DEFAULTS, ...res }
      privacyLoaded.value = true
    } catch {
      privacyLoaded.value = false
    }
  }

  async function updatePrivacy(
    key: keyof PrivacySettings,
    value: Visibility,
  ): Promise<boolean> {
    const previous = privacy.value[key]
    privacy.value = { ...privacy.value, [key]: value }
    privacySaving.value = true
    privacyError.value = null
    try {
      const fresh = await apiPatchGroup<PrivacySettings>('privacy', { [key]: value })
      privacy.value = { ...PRIVACY_DEFAULTS, ...fresh }
      return true
    } catch {
      privacy.value = { ...privacy.value, [key]: previous }
      privacyError.value = "Couldn't save privacy setting."
      return false
    } finally {
      privacySaving.value = false
    }
  }

  async function fetchAppearance(): Promise<void> {
    try {
      const res = await apiGetGroup<AppearanceSettings>('appearance')
      appearance.value = { ...APPEARANCE_DEFAULTS, ...res }
      appearanceLoaded.value = true
    } catch {
      appearanceLoaded.value = false
    }
  }

  async function updateAppearance<K extends keyof AppearanceSettings>(
    key: K,
    value: AppearanceSettings[K],
  ): Promise<boolean> {
    const previous = appearance.value[key]
    if (appearanceSaving.value) return false
    appearance.value = { ...appearance.value, [key]: value }
    appearanceSaving.value = true
    appearanceError.value = null
    try {
      const fresh = await apiPatchGroup<AppearanceSettings>('appearance', { [key]: value })
      appearance.value = { ...APPEARANCE_DEFAULTS, ...fresh }
      return true
    } catch {
      appearance.value = { ...appearance.value, [key]: previous }
      appearanceError.value = "Couldn't save appearance setting."
      return false
    } finally {
      appearanceSaving.value = false
    }
  }

  function reset() {
    privacy.value = { ...PRIVACY_DEFAULTS }
    privacyLoaded.value = false
    privacyError.value = null
    appearance.value = { ...APPEARANCE_DEFAULTS }
    appearanceLoaded.value = false
    appearanceError.value = null
  }

  async function fetchGroup<T extends SettingsBag>(group: SettingGroup): Promise<T | null> {
    try {
      return await apiGetGroup<T>(group)
    } catch {
      return null
    }
  }

  return {
    privacy,
    privacyLoaded,
    privacySaving,
    privacyError,
    fetchPrivacy,
    updatePrivacy,
    appearance,
    appearanceLoaded,
    appearanceSaving,
    appearanceError,
    fetchAppearance,
    updateAppearance,
    fetchGroup,
    reset,
  }
})
