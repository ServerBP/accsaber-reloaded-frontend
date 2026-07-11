<script setup lang="ts">
import { equipItem, getItems, getUserItems } from '@/api/items'
import ThemeBackdropPreview from '@/components/layout/ThemeBackdropPreview.vue'
import { useAuthStore } from '@/stores/auth'
import { useItemTypeStore } from '@/stores/itemTypes'
import { useThemeStore } from '@/stores/theme'
import type { ItemResponse, UserItemResponse } from '@/types/api/items'
import { filterThemableTokens, readThemeValue } from '@/utils/items'
import { computed, onMounted, ref, watch } from 'vue'

interface ThemeCard {
  id: string
  themeKey: string
  name: string
  description: string | null
  requirement: string | null
  builtin: boolean
  owned: boolean
  itemId: string | null
  tokens: Record<string, string> | null
  altTokens: Record<string, string> | null
}

const authStore = useAuthStore()
const themeStore = useThemeStore()
const itemTypeStore = useItemTypeStore()

const BUILTIN_THEMES: ThemeCard[] = [
  { id: 'builtin-dark', themeKey: 'dark', name: 'Dark', description: 'Default dark mode.', requirement: null, builtin: true, owned: true, itemId: null, tokens: null, altTokens: null },
  { id: 'builtin-light', themeKey: 'light', name: 'Light', description: 'Default light mode.', requirement: null, builtin: true, owned: true, itemId: null, tokens: null, altTokens: null },
]

const BUILTIN_PREVIEW_TOKENS: Record<string, Record<string, string>> = {
  dark: { 'bg-base': '#08080d', 'bg-surface': '#11111c', 'bg-elevated': '#1a1929', 'accent': '#f5b800' },
  light: { 'bg-base': '#f3f2f7', 'bg-surface': '#fdfcff', 'bg-elevated': '#ebe9f1', 'accent': '#f5b800' },
}

const BUILTIN_NAMES = new Set(BUILTIN_THEMES.map((t) => t.name.toLowerCase()))

const themeCatalog = ref<ItemResponse[]>([])
const ownedThemes = ref<UserItemResponse[]>([])
const themeBusy = ref<string | null>(null)

const ownedThemeItemIds = computed(() => new Set(ownedThemes.value.map((u) => u.item.id)))
const ownedThemeLinkByItemId = computed(() => {
  const map = new Map<string, string>()
  for (const u of ownedThemes.value) map.set(u.item.id, u.linkId)
  return map
})

const inventoryThemeCards = computed<ThemeCard[]>(() =>
  themeCatalog.value
    .filter((i) => i.active && !i.deprecated)
    .map((i) => {
      const themeValue = readThemeValue(i.value)
      return {
        id: i.id,
        themeKey: `item:${i.id}`,
        name: i.name,
        description: i.description,
        requirement: i.requirement,
        builtin: false,
        owned: ownedThemeItemIds.value.has(i.id),
        itemId: i.id,
        tokens: themeValue?.tokens ?? null,
        altTokens: themeValue?.altTokens ?? null,
      }
    })
    .filter((c) => c.tokens != null),
)

const themeCards = computed<ThemeCard[]>(() => {
  const ownedBuiltinByName = new Map<string, ThemeCard>()
  const extras: ThemeCard[] = []
  for (const card of inventoryThemeCards.value) {
    const nameLower = card.name.toLowerCase()
    if (BUILTIN_NAMES.has(nameLower)) {
      if (card.owned) ownedBuiltinByName.set(nameLower, card)
    } else {
      extras.push(card)
    }
  }
  const builtins = BUILTIN_THEMES.map((b) => ownedBuiltinByName.get(b.name.toLowerCase()) ?? b)
  return [...builtins, ...extras]
})

function tokensToPreviewVars(tokens: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  if (tokens['bg-base']) out['--preview-base'] = tokens['bg-base']
  if (tokens['bg-surface']) out['--preview-surface'] = tokens['bg-surface']
  if (tokens['bg-elevated']) out['--preview-elevated'] = tokens['bg-elevated']
  const accent = tokens['accent'] ?? tokens['accent-overall']
  if (accent) out['--preview-accent'] = accent
  return out
}

function previewVars(card: ThemeCard): Record<string, string> {
  const tokens = card.builtin ? BUILTIN_PREVIEW_TOKENS[card.themeKey] : (card.tokens ? filterThemableTokens(card.tokens) : {})
  return tokensToPreviewVars(tokens)
}

function variantLabel(tokens: Record<string, string>): string {
  return tokens.base === 'light' ? 'Light' : 'Dark'
}

function isVariantActive(card: ThemeCard, alt: boolean): boolean {
  if (themeStore.theme !== card.themeKey || !themeStore.activeTokens) return false
  const variant = alt ? card.altTokens : card.tokens
  if (!variant) return false
  return JSON.stringify(themeStore.activeTokens) === JSON.stringify(variant)
}

function lockedHint(card: ThemeCard): string {
  return card.requirement ?? card.description ?? 'Locked theme.'
}

async function loadThemes() {
  await itemTypeStore.fetchItemTypes()
  const themeTypeId = itemTypeStore.byKey.get('theme')?.id
  if (!themeTypeId) {
    themeCatalog.value = []
    return
  }
  try {
    themeCatalog.value = await getItems({ typeId: themeTypeId })
  } catch {
    themeCatalog.value = []
  }

  if (!authStore.userId) {
    ownedThemes.value = []
    return
  }
  try {
    ownedThemes.value = await getUserItems(authStore.userId, { typeKey: 'theme' })
  } catch {
    ownedThemes.value = []
  }
}

async function pickTheme(card: ThemeCard, alt = false) {
  if (!card.owned || themeBusy.value) return
  themeBusy.value = card.id
  try {
    if (!card.builtin && card.itemId) {
      const linkId = ownedThemeLinkByItemId.value.get(card.itemId)
      if (!linkId) return
      await equipItem({ linkId })
    }
    const tokens = alt ? card.altTokens : card.tokens
    if (card.builtin) {
      themeStore.setTheme(card.themeKey)
    } else if (tokens) {
      themeStore.setThemeFromTokens(card.themeKey, tokens)
    }
  } catch {
  } finally {
    themeBusy.value = null
  }
}

onMounted(loadThemes)
watch(() => authStore.userId, loadThemes)
</script>

<template>
  <div class="theme-grid" role="radiogroup" aria-label="Theme">
    <template v-for="card in themeCards" :key="card.id">
    <div
      v-if="card.altTokens && card.tokens && card.owned"
      class="theme-card theme-card--dual"
      :class="{ 'theme-card--active': themeStore.theme === card.themeKey }"
    >
      <button
        v-for="alt in [false, true]"
        :key="String(alt)"
        type="button"
        class="theme-card__half"
        :class="{ 'theme-card__half--active': isVariantActive(card, alt) }"
        role="radio"
        :aria-checked="isVariantActive(card, alt)"
        :disabled="themeBusy === card.id"
        @click="pickTheme(card, alt)"
      >
        <div class="theme-card__preview" :style="tokensToPreviewVars((alt ? card.altTokens : card.tokens)!)">
          <ThemeBackdropPreview :tokens="(alt ? card.altTokens : card.tokens)!" />
          <span class="theme-card__swatch theme-card__swatch--bg" />
          <span class="theme-card__swatch theme-card__swatch--surface" />
          <span class="theme-card__swatch theme-card__swatch--accent" />
        </div>
        <div class="theme-card__body">
          <span class="theme-card__name">{{ card.name }}</span>
          <span class="theme-card__hint">{{ variantLabel((alt ? card.altTokens : card.tokens)!) }}</span>
        </div>
        <span v-if="isVariantActive(card, alt)" class="theme-card__active-tag">Active</span>
      </button>
    </div>
    <button v-else type="button" class="theme-card" :class="{
      'theme-card--active': themeStore.theme === card.themeKey,
      'theme-card--locked': !card.owned,
      'theme-card--builtin': card.builtin,
    }" role="radio" :aria-checked="themeStore.theme === card.themeKey"
      :disabled="!card.owned || themeBusy === card.id" :title="!card.owned ? lockedHint(card) : undefined"
      @click="pickTheme(card)">
      <div class="theme-card__preview" :style="previewVars(card)">
        <ThemeBackdropPreview :tokens="card.tokens" />
        <span class="theme-card__swatch theme-card__swatch--bg" />
        <span class="theme-card__swatch theme-card__swatch--surface" />
        <span class="theme-card__swatch theme-card__swatch--accent" />
      </div>
      <div class="theme-card__body">
        <span class="theme-card__name">{{ card.name }}</span>
        <span class="theme-card__hint">
          <template v-if="card.builtin">Default theme</template>
          <template v-else-if="card.owned">{{ card.description ?? 'Owned' }}</template>
          <template v-else>{{ lockedHint(card) }}</template>
        </span>
      </div>
      <span v-if="themeStore.theme === card.themeKey" class="theme-card__active-tag">Active</span>
      <span v-else-if="!card.owned" class="theme-card__lock-tag" aria-label="Locked">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </span>
    </button>
    </template>
  </div>
</template>

<style scoped>
.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-sm);
}

.theme-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  color: var(--text-primary);
  font-family: var(--font-sans);
  text-align: left;
  cursor: pointer;
  transition: border-color 120ms ease, background-color 120ms ease;
}

.theme-card:hover:not(:disabled) {
  border-color: var(--text-tertiary);
}

.theme-card--active {
  border-color: var(--page-accent);
  background: color-mix(in srgb, var(--page-accent) 6%, var(--bg-base));
}

.theme-card--locked {
  cursor: not-allowed;
  opacity: 0.55;
}

.theme-card--dual {
  padding: 0;
  overflow: hidden;
  align-items: stretch;
  gap: 0;
}

.theme-card__half {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
  padding: var(--space-md) var(--space-sm);
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-family: var(--font-sans);
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.theme-card__half + .theme-card__half {
  border-left: 1px solid var(--bg-overlay);
}

.theme-card__half:hover:not(:disabled) {
  background: var(--bg-elevated);
}

.theme-card__half--active {
  background: color-mix(in srgb, var(--page-accent) 8%, transparent);
}

.theme-card__preview {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 56px;
  height: 40px;
  flex-shrink: 0;
  padding: 4px;
  border-radius: var(--radius-btn);
  border: 1px solid color-mix(in srgb, var(--preview-surface, var(--bg-overlay)) 60%, transparent);
  background: var(--preview-base, var(--bg-base));
  overflow: hidden;
}

.theme-card__swatch {
  position: relative;
  z-index: 1;
  display: block;
  height: 6px;
  border-radius: 2px;
}

.theme-card__swatch--bg { background: var(--preview-surface, var(--bg-elevated)); }
.theme-card__swatch--surface { background: var(--preview-elevated, var(--bg-overlay)); width: 70%; }
.theme-card__swatch--accent { background: var(--preview-accent, var(--page-accent)); width: 40%; }

.theme-card__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.theme-card__name {
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
}

.theme-card__hint {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  line-height: 1.4;
}

.theme-card__active-tag {
  position: absolute;
  top: var(--space-xs);
  right: var(--space-xs);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--page-accent);
}

.theme-card__lock-tag {
  position: absolute;
  top: var(--space-xs);
  right: var(--space-xs);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}
</style>
