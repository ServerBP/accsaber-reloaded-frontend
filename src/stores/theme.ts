import { applyThemeTokens, clearThemeTokens } from '@/utils/items'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export type BuiltinTheme = 'dark' | 'light'
export type Theme = BuiltinTheme | string

const TOKENS_STORAGE_KEY = 'theme:tokens'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('theme')
  if (stored) return stored
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

function loadStoredTokens(): Record<string, string> | null {
  const raw = localStorage.getItem(TOKENS_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string>
  } catch {
    /* fallthrough */
  }
  return null
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>(getInitialTheme())
  const activeTokens = ref<Record<string, string> | null>(loadStoredTokens())

  const resolvedBase = computed<BuiltinTheme>(() => {
    if (activeTokens.value) return activeTokens.value.base === 'light' ? 'light' : 'dark'
    return theme.value === 'light' ? 'light' : 'dark'
  })

  let transitionTimer: ReturnType<typeof setTimeout> | null = null

  function applyResolvedBase(animated = true) {
    const root = document.documentElement
    if (animated) {
      root.classList.add('theme-transitioning')
      if (transitionTimer) clearTimeout(transitionTimer)
      transitionTimer = setTimeout(() => {
        root.classList.remove('theme-transitioning')
        transitionTimer = null
      }, 220)
    }
    root.setAttribute('data-theme', resolvedBase.value)
  }

  function setTheme(value: Theme) {
    if (activeTokens.value) {
      clearThemeTokens(activeTokens.value)
      activeTokens.value = null
      localStorage.removeItem(TOKENS_STORAGE_KEY)
    }
    theme.value = value
  }

  function setThemeFromTokens(themeKey: string, tokens: Record<string, string>) {
    if (activeTokens.value) clearThemeTokens(activeTokens.value)
    activeTokens.value = tokens
    localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(tokens))
    applyThemeTokens(tokens)
    theme.value = themeKey
  }

  function previewThemeTokens(tokens: Record<string, string> | null) {
    if (activeTokens.value) clearThemeTokens(activeTokens.value)
    activeTokens.value = tokens
    if (tokens) applyThemeTokens(tokens)
  }

  function toggle() {
    setTheme(resolvedBase.value === 'dark' ? 'light' : 'dark')
  }

  watch(theme, (value) => {
    localStorage.setItem('theme', value)
  }, { immediate: true })

  watch(resolvedBase, (_, prev) => {
    applyResolvedBase(prev !== undefined)
  }, { immediate: true })

  if (activeTokens.value) {
    applyThemeTokens(activeTokens.value)
  }

  return { theme, activeTokens, resolvedBase, toggle, setTheme, setThemeFromTokens, previewThemeTokens }
})
