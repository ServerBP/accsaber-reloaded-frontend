import PixelFieldBackdrop from '@/components/layout/PixelFieldBackdrop.vue'
import StarfieldBackdrop from '@/components/layout/StarfieldBackdrop.vue'
import type { ThemeBackdropType } from '@/utils/themeBackdrop'
import type { Component } from 'vue'

export const BACKDROP_RENDERERS: Record<ThemeBackdropType, Component> = {
  starfield: StarfieldBackdrop,
  pixel_field: PixelFieldBackdrop,
}
