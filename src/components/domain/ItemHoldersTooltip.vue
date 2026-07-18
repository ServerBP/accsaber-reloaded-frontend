<script setup lang="ts">
import CountryFlag from '@/components/domain/CountryFlag.vue'
import ModifierChip from '@/components/domain/ModifierChip.vue'
import { onAvatarError, pickAvatarFallback, pickAvatarUrl } from '@/composables/useAvatarFallback'
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import { useAuthStore } from '@/stores/auth'
import { useItemModifierStore } from '@/stores/itemModifiers'
import type { ItemHolderResponse, ItemHolderSort } from '@/types/api/items'
import { resolveModifierRefs } from '@/utils/items'
import { computed, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  itemId: string
  itemName: string
  ownerCount: number
}>()

const authStore = useAuthStore()
const modifierStore = useItemModifierStore()

const PAGE_SIZE = 8
const POPUP_WIDTH = 300
const SCROLL_OPTS: AddEventListenerOptions = { capture: true, passive: true }

type Mode = 'hidden' | 'hover' | 'locked'

const mode = ref<Mode>('hidden')
const locked = computed(() => mode.value === 'locked')
const visible = computed(() => mode.value !== 'hidden')

const triggerRef = ref<HTMLElement | null>(null)
const popupRef = ref<HTMLElement | null>(null)
const popupStyle = ref<Record<string, string>>({})
const accent = ref('')

const holders = ref<ItemHolderResponse[]>([])
const page = ref(0)
const totalElements = ref(props.ownerCount)
const last = ref(true)
const loading = ref(false)
const loadingMore = ref(false)

const sort = ref<ItemHolderSort>('RECENT')
const selectedModifiers = ref<string[]>([])
const searchInput = ref('')
const search = useDebouncedRef(searchInput, 300)

let hoverTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let requestId = 0
let loadedKey: string | null = null

const sortOptions = computed<{ value: ItemHolderSort; label: string }[]>(() => {
  const opts: { value: ItemHolderSort; label: string }[] = [
    { value: 'RECENT', label: 'Recent' },
    { value: 'RANK', label: 'Rank' },
  ]
  if (authStore.isLoggedIn) opts.push({ value: 'FOLLOWING', label: 'Following' })
  return opts
})

const remaining = computed(() => Math.max(0, totalElements.value - holders.value.length))

const filterKey = computed(() =>
  JSON.stringify([sort.value, [...selectedModifiers.value].sort(), search.value]),
)

function resolveModifiers(keys: string[]) {
  return resolveModifierRefs(keys, modifierStore.byKey)
}

async function load(reset: boolean) {
  if (reset) {
    page.value = 0
    loading.value = true
  } else {
    if (last.value || loadingMore.value) return
    page.value += 1
    loadingMore.value = true
  }
  const id = ++requestId
  const requestedKey = filterKey.value
  try {
    const { getItemHolders } = await import('@/api/items')
    const result = await getItemHolders(props.itemId, {
      page: page.value,
      size: PAGE_SIZE,
      sort: sort.value,
      modifier: selectedModifiers.value.length ? selectedModifiers.value : undefined,
      search: search.value || undefined,
    })
    if (id !== requestId) return
    holders.value = reset ? result.content : [...holders.value, ...result.content]
    totalElements.value = result.totalElements
    last.value = result.last
    loadedKey = requestedKey
  } catch {
    if (id !== requestId) return
    if (reset) holders.value = []
    else page.value -= 1
  } finally {
    if (id === requestId) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function ensureLoaded() {
  if (loadedKey !== filterKey.value && !loading.value) load(true)
}

function resolveAccent() {
  const el = triggerRef.value
  if (!el) return
  const value = getComputedStyle(el).getPropertyValue('--accent').trim()
  if (value) accent.value = value
}

function updatePosition() {
  const el = triggerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const margin = 8
  const maxLeft = window.innerWidth - POPUP_WIDTH - margin
  popupStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + margin}px`,
    left: `${Math.max(margin, Math.min(rect.left, maxLeft))}px`,
    width: `${POPUP_WIDTH}px`,
  }
}

function onScrollOrResize() {
  if (!visible.value) return
  updatePosition()
}

function attachListeners() {
  window.addEventListener('scroll', onScrollOrResize, SCROLL_OPTS)
  window.addEventListener('resize', onScrollOrResize, { passive: true })
  document.addEventListener('pointerdown', onOutsidePointer, true)
}

function detachListeners() {
  window.removeEventListener('scroll', onScrollOrResize, SCROLL_OPTS)
  window.removeEventListener('resize', onScrollOrResize)
  document.removeEventListener('pointerdown', onOutsidePointer, true)
}

function onOutsidePointer(e: PointerEvent) {
  if (!locked.value) return
  const target = e.target as Node | null
  if (!target) return
  if (triggerRef.value?.contains(target)) return
  if (popupRef.value?.contains(target)) return
  close()
}

function clearTimers() {
  if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

function openHover() {
  if (visible.value) return
  resolveAccent()
  updatePosition()
  mode.value = 'hover'
  attachListeners()
  modifierStore.fetchModifiers()
  ensureLoaded()
}

function close() {
  if (!visible.value) return
  mode.value = 'hidden'
  detachListeners()
  if (activeLock === closeThis) activeLock = null
}

function lock() {
  resolveAccent()
  updatePosition()
  if (activeLock && activeLock !== closeThis) activeLock()
  activeLock = closeThis
  mode.value = 'locked'
  attachListeners()
  modifierStore.fetchModifiers()
  ensureLoaded()
}

const closeThis = () => close()

function scheduleHide() {
  if (locked.value) return
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (!locked.value) close()
  }, 160)
}

function onMouseEnter() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  if (visible.value) return
  hoverTimer = setTimeout(openHover, 350)
}

function onMouseLeave() {
  if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
  scheduleHide()
}

function onToggle() {
  clearTimers()
  if (locked.value) close()
  else lock()
}

function onPopupEnter() {
  clearTimers()
}

function onPopupLeave() {
  scheduleHide()
}

function toggleModifier(key: string) {
  const idx = selectedModifiers.value.indexOf(key)
  if (idx === -1) selectedModifiers.value = [...selectedModifiers.value, key]
  else selectedModifiers.value = selectedModifiers.value.filter((k) => k !== key)
}

function selectSort(value: ItemHolderSort) {
  if (sort.value !== value) sort.value = value
}

watch(filterKey, () => {
  if (visible.value) load(true)
})

watch(
  () => props.itemId,
  () => {
    holders.value = []
    loadedKey = null
    totalElements.value = props.ownerCount
    last.value = true
    if (visible.value) ensureLoaded()
  },
)

onUnmounted(() => {
  clearTimers()
  detachListeners()
  if (activeLock === closeThis) activeLock = null
})
</script>

<script lang="ts">
let activeLock: (() => void) | null = null
</script>

<template>
  <span
    ref="triggerRef"
    class="holders-tip"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <button
      type="button"
      class="holders-tip__btn"
      :class="{ 'holders-tip__btn--active': visible }"
      :aria-label="`Who owns ${itemName}`"
      :aria-expanded="visible"
      @click.stop.prevent="onToggle"
      @keydown.escape="close"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </button>

    <Teleport to="body">
      <Transition name="holders-tip">
        <div
          v-if="visible"
          ref="popupRef"
          class="holders-tip__popup"
          :class="{ 'holders-tip__popup--locked': locked }"
          :style="{ ...popupStyle, '--accent': accent || undefined }"
          role="dialog"
          @mouseenter="onPopupEnter"
          @mouseleave="onPopupLeave"
        >
          <div class="holders-tip__head">
            <span class="holders-tip__title">Owned by</span>
            <span class="holders-tip__count">{{ totalElements.toLocaleString() }}</span>
            <button v-if="locked" type="button" class="holders-tip__close" aria-label="Close" @click.stop="close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div v-if="locked" class="holders-tip__controls">
            <input
              v-model="searchInput"
              type="text"
              class="holders-tip__search"
              placeholder="Search players"
              @click.stop
            />

            <div class="holders-tip__sorts" role="tablist">
              <button
                v-for="opt in sortOptions"
                :key="opt.value"
                type="button"
                class="holders-tip__sort"
                :class="{ 'holders-tip__sort--active': sort === opt.value }"
                @click.stop="selectSort(opt.value)"
              >{{ opt.label }}</button>
            </div>

            <div v-if="modifierStore.modifiers.length" class="holders-tip__mods">
              <button
                v-for="mod in modifierStore.modifiers"
                :key="mod.key"
                type="button"
                class="holders-tip__mod"
                :class="{ 'holders-tip__mod--active': selectedModifiers.includes(mod.key) }"
                :style="{ '--mod-color': mod.colorHex || 'var(--text-secondary)' }"
                @click.stop="toggleModifier(mod.key)"
              >{{ mod.name }}</button>
            </div>
          </div>

          <div v-if="loading" class="holders-tip__list">
            <div v-for="i in Math.min(Math.max(props.ownerCount, 1), PAGE_SIZE)" :key="i" class="holders-tip__shimmer" />
          </div>

          <div v-else-if="holders.length === 0" class="holders-tip__empty">
            {{ search || selectedModifiers.length ? 'No holders match those filters.' : 'No one owns this yet.' }}
          </div>

          <template v-else>
            <div class="holders-tip__list" :class="{ 'holders-tip__list--locked': locked }">
              <RouterLink
                v-for="h in holders"
                :key="h.userId"
                :to="{ name: 'player-profile', params: { userId: h.userId } }"
                class="holders-tip__row"
              >
                <img
                  :src="pickAvatarUrl(h)"
                  :alt="h.userName"
                  class="holders-tip__avatar"
                  loading="lazy"
                  decoding="async"
                  @error="onAvatarError(pickAvatarFallback(h))($event)"
                />
                <div class="holders-tip__who">
                  <div class="holders-tip__nameline">
                    <span class="holders-tip__name">{{ h.userName }}</span>
                    <CountryFlag :country="h.country" />
                    <svg v-if="h.following" class="holders-tip__follow" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                      aria-hidden="true"><title>Following</title>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <div v-if="resolveModifiers(h.modifiers).length" class="holders-tip__rowmods">
                    <ModifierChip v-for="mod in resolveModifiers(h.modifiers)" :key="mod.id" :modifier="mod" />
                  </div>
                </div>
                <div class="holders-tip__stats">
                  <span v-if="h.ranking != null" class="holders-tip__rank">#{{ h.ranking.toLocaleString() }}</span>
                  <span v-if="h.quantity > 1" class="holders-tip__qty">×{{ h.quantity }}</span>
                  <span v-if="h.lowestSerial != null" class="holders-tip__serial">#{{ h.lowestSerial }}</span>
                </div>
              </RouterLink>
            </div>

            <button
              v-if="locked && !last"
              type="button"
              class="holders-tip__more"
              :disabled="loadingMore"
              @click.stop="load(false)"
            >{{ loadingMore ? 'Loading…' : 'Show more' }}</button>

            <div v-else-if="!locked && remaining > 0" class="holders-tip__foot">
              …and {{ remaining.toLocaleString() }} other{{ remaining === 1 ? '' : 's' }}. Click to search &amp; filter.
            </div>
          </template>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<style scoped>
.holders-tip {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.holders-tip__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border-radius: 50%;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease, background-color 120ms ease;
}

.holders-tip__btn:hover,
.holders-tip__btn--active {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
  background: var(--bg-overlay);
}

.holders-tip__btn:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
}
</style>

<style>
.holders-tip__popup {
  z-index: 10000;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  overflow: hidden;
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.4));
  pointer-events: auto;
}

.holders-tip__head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--bg-overlay);
}

.holders-tip__title {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.holders-tip__count {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.holders-tip__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  padding: 2px;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-btn);
  transition: color 120ms ease, background-color 120ms ease;
}

.holders-tip__close:hover {
  color: var(--text-primary);
  background: var(--bg-overlay);
}

.holders-tip__controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--bg-overlay);
}

.holders-tip__search {
  width: 100%;
  padding: 6px var(--space-sm);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  outline: none;
  transition: border-color 120ms ease;
}

.holders-tip__search:focus {
  border-color: var(--accent);
}

.holders-tip__search::placeholder {
  color: var(--text-tertiary);
}

.holders-tip__sorts {
  display: flex;
  gap: 4px;
}

.holders-tip__sort {
  flex: 1;
  padding: 4px 6px;
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  color: var(--text-secondary);
  font-size: var(--text-caption);
  font-weight: 500;
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease;
}

.holders-tip__sort:hover {
  color: var(--text-primary);
}

.holders-tip__sort--active {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.holders-tip__mods {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.holders-tip__mod {
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--bg-overlay);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease;
}

.holders-tip__mod--active {
  color: var(--mod-color);
  border-color: color-mix(in srgb, var(--mod-color) 50%, transparent);
  background: color-mix(in srgb, var(--mod-color) 12%, transparent);
}

.holders-tip__list {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  max-height: 260px;
}

.holders-tip__list--locked {
  max-height: 300px;
}

.holders-tip__row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  text-decoration: none;
  transition: background-color 80ms ease;
}

.holders-tip__row:hover {
  background: var(--bg-elevated);
}

.holders-tip__avatar {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-avatar);
  object-fit: cover;
  flex-shrink: 0;
}

.holders-tip__who {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.holders-tip__nameline {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.holders-tip__name {
  font-size: var(--text-caption);
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.holders-tip__follow {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--accent);
}

.holders-tip__rowmods {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.holders-tip__stats {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 0.625rem;
}

.holders-tip__rank {
  color: var(--text-secondary);
}

.holders-tip__qty {
  color: var(--accent);
  font-weight: 600;
}

.holders-tip__serial {
  color: var(--text-tertiary);
}

.holders-tip__more {
  padding: var(--space-sm);
  background: transparent;
  border: none;
  border-top: 1px solid var(--bg-overlay);
  color: var(--accent);
  font-size: var(--text-caption);
  font-weight: 600;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.holders-tip__more:hover:not(:disabled) {
  background: var(--bg-elevated);
}

.holders-tip__more:disabled {
  color: var(--text-tertiary);
  cursor: default;
}

.holders-tip__foot {
  padding: var(--space-xs) var(--space-md) var(--space-sm);
  font-size: 0.625rem;
  color: var(--text-tertiary);
  line-height: 1.4;
}

.holders-tip__empty {
  padding: var(--space-md);
  text-align: center;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.holders-tip__list .holders-tip__shimmer {
  height: 30px;
  margin: 3px var(--space-md);
  border-radius: var(--radius-btn);
  background: var(--bg-elevated);
  animation: holders-tip-shimmer 1.5s ease-in-out infinite;
}

@keyframes holders-tip-shimmer {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.85; }
}

.holders-tip-enter-active {
  transition: opacity 150ms ease-out, transform 150ms ease-out;
}

.holders-tip-leave-active {
  transition: opacity 100ms ease-in, transform 100ms ease-in;
}

.holders-tip-enter-from,
.holders-tip-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .holders-tip__shimmer {
    animation: none;
  }

  .holders-tip-enter-from,
  .holders-tip-leave-to {
    transform: none;
  }
}
</style>
