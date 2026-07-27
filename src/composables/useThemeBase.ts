import { computed, inject, provide, type ComputedRef, type InjectionKey } from 'vue'
import { useThemeStore, type BuiltinTheme } from '@/stores/theme'

const THEME_BASE_OVERRIDE: InjectionKey<ComputedRef<BuiltinTheme>> = Symbol('theme-base')

export function provideThemeBase(base: ComputedRef<BuiltinTheme>): void {
  provide(THEME_BASE_OVERRIDE, base)
}

export function useThemeBase(): ComputedRef<BuiltinTheme> {
  const override = inject(THEME_BASE_OVERRIDE, null)
  const themeStore = useThemeStore()
  return computed(() => override?.value ?? themeStore.resolvedBase)
}
