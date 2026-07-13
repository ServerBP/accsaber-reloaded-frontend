import type { Component } from 'vue'
import AuroraEffect from './AuroraEffect.vue'
import BorderOutlineEffect from './BorderOutlineEffect.vue'
import EntityEffect from './EntityEffect.vue'
import FilterEffect from './FilterEffect.vue'
import FirefliesEffect from './FirefliesEffect.vue'
import FireworksEffect from './FireworksEffect.vue'
import GlowEffect from './GlowEffect.vue'
import HolographicEffect from './HolographicEffect.vue'
import LabelOverlayEffect from './LabelOverlayEffect.vue'
import NightSkyEffect from './NightSkyEffect.vue'
import ParticleFieldEffect from './ParticleFieldEffect.vue'
import RaysEffect from './RaysEffect.vue'
import SnowfallEffect from './SnowfallEffect.vue'

export const EFFECT_REGISTRY: Record<string, Component> = {
  border_outline: BorderOutlineEffect,
  label_overlay: LabelOverlayEffect,
  stat_counter: LabelOverlayEffect,
  filter: FilterEffect,
  glow: GlowEffect,
  holographic: HolographicEffect,
  particles: ParticleFieldEffect,
  rays: RaysEffect,
  aurora: AuroraEffect,
  entity: EntityEffect,
  fireflies: FirefliesEffect,
  fireworks: FireworksEffect,
  snowfall: SnowfallEffect,
  night_sky: NightSkyEffect,
}

export const BLEED_TYPES = new Set(['aurora', 'entity', 'snowfall', 'fireworks', 'fireflies'])
