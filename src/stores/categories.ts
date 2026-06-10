import { getCategories } from '@/api/categories'
import { useThemeStore } from '@/stores/theme'
import type { CategoryResponse } from '@/types/api/categories'
import type { CategoryCode, CategoryInfo } from '@/types/display'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const ULTIMATE_FALLBACK = '#f5b800'

const EXTRA_CODES = ['xp'] as const

function cssVarName(prefix: string, code: string): string {
  return `--${prefix}-${code.replace(/_/g, '-')}`
}

function readCssToken(prefix: string, code: string): string {
  if (typeof document === 'undefined') return ULTIMATE_FALLBACK
  const val = getComputedStyle(document.documentElement).getPropertyValue(cssVarName(prefix, code)).trim()
  return val || ULTIMATE_FALLBACK
}

const EXTRA_NAMES: Record<string, string> = {
  xp: 'XP',
}

const STORAGE_KEY = 'cache:categories'

function loadCachedCategories(): CategoryResponse[] {
  if (typeof sessionStorage === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as CategoryResponse[] : []
  } catch {
    return []
  }
}

export const useCategoryStore = defineStore('categories', () => {
  const themeStore = useThemeStore()
  const cached = loadCachedCategories()
  const categories = ref<CategoryResponse[]>(cached)
  const loaded = ref(cached.length > 0)

  const byId = computed(() => {
    const map = new Map<string, CategoryResponse>()
    for (const cat of categories.value) {
      map.set(cat.id, cat)
    }
    return map
  })

  const byCode = computed(() => {
    const map = new Map<string, CategoryResponse>()
    for (const cat of categories.value) {
      map.set(cat.code, cat)
    }
    return map
  })

  const categoryInfoList = computed<CategoryInfo[]>(() => {
    void themeStore.theme
    void themeStore.activeTokens
    const list = categories.value.map((cat) => ({
      code: cat.code,
      name: cat.name,
      accent: readCssToken('accent', cat.code),
      tint: readCssToken('tint', cat.code),
      tintLight: readCssToken('tint', cat.code),
    }))
    const extras: CategoryInfo[] = EXTRA_CODES.map((code) => ({
      code,
      name: EXTRA_NAMES[code] ?? code,
      accent: readCssToken('accent', code),
      tint: readCssToken('tint', code),
      tintLight: readCssToken('tint', code),
    }))
    return [...list, ...extras]
  })

  const categoryInfoByCode = computed(() => {
    const map = new Map<string, CategoryInfo>()
    for (const info of categoryInfoList.value) {
      map.set(info.code, info)
    }
    return map
  })

  function getCategoryId(code: CategoryCode): string | undefined {
    return byCode.value.get(code)?.id
  }

  function getCategoryCode(id: string): CategoryCode | undefined {
    return byId.value.get(id)?.code
  }

  function getCategoryInfo(code: string): CategoryInfo | undefined {
    return categoryInfoByCode.value.get(code)
  }

  function getAccent(code: string): string {
    return readCssToken('accent', code)
  }

  async function fetchCategories(force = false): Promise<void> {
    if (loaded.value && !force) return
    try {
      const result = await getCategories()
      categories.value = result
      loaded.value = true
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result))
      } catch {
      }
    } catch {
    }
  }

  return {
    categories,
    loaded,
    byId,
    byCode,
    categoryInfoList,
    categoryInfoByCode,
    getCategoryId,
    getCategoryCode,
    getCategoryInfo,
    getAccent,
    fetchCategories,
  }
})
