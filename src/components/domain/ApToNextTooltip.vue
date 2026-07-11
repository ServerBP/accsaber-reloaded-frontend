<script setup lang="ts">
import { useCategoryStore } from '@/stores/categories'
import type { SkillCategory, SkillResponse } from '@/types/api/users'
import type { CategoryCode } from '@/types/display'
import { computed, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  userId: string
  category: CategoryCode
}>()

const categoryStore = useCategoryStore()

const showTooltip = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const popupRef = ref<HTMLElement | null>(null)
const tooltipStyle = ref<Record<string, string>>({})

const skill = ref<SkillResponse | null>(null)
const loading = ref(false)
const failed = ref(false)
let fetchedUserId: string | null = null

let hoverTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

const SCROLL_OPTS: AddEventListenerOptions = { capture: true, passive: true }
const POPUP_WIDTH = 240

function normalizeCode(code: string): string {
  return code.replace(/_acc$/, '')
}

function accentFor(code: string): string {
  return categoryStore.getAccent(code)
}

const categoryRows = computed(() => {
  if (!skill.value) return []
  const entries = skill.value.skills.filter(
    (s) => s.categoryCode !== 'overall' && s.categoryCode !== 'xp',
  )
  const toRow = (s: SkillCategory) => ({
    code: s.categoryCode,
    name: s.categoryName,
    ap: s.components.rawApForOneGain,
    accent: accentFor(s.categoryCode),
  })

  if (props.category === 'overall') {
    return entries
      .filter((s) => s.components.rawApForOneGain > 0)
      .map(toRow)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  const target = normalizeCode(props.category)
  const match = entries.find((s) => normalizeCode(s.categoryCode) === target)
  if (!match || match.components.rawApForOneGain <= 0) return []
  return [toRow(match)]
})

function formatAp(value: number): string {
  return `${value.toFixed(1)} AP`
}

async function ensureSkill() {
  if (fetchedUserId === props.userId && skill.value) return
  loading.value = true
  failed.value = false
  try {
    const { getUserSkill } = await import('@/api/users')
    const result = await getUserSkill(props.userId)
    skill.value = result
    fetchedUserId = props.userId
  } catch {
    skill.value = null
    failed.value = true
  } finally {
    loading.value = false
  }
}

function clearHoverTimer() {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
}

function clearHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function updatePosition() {
  const el = triggerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const margin = 8
  const maxLeft = window.innerWidth - POPUP_WIDTH - margin
  const left = Math.max(margin, Math.min(rect.left, maxLeft))
  tooltipStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + margin}px`,
    left: `${left}px`,
    width: `${POPUP_WIDTH}px`,
  }
}

function onScrollOrResize() {
  if (!showTooltip.value) return
  updatePosition()
}

function onOutsidePointer(e: PointerEvent) {
  const target = e.target as Node | null
  if (!target) return
  if (triggerRef.value?.contains(target)) return
  if (popupRef.value?.contains(target)) return
  hide()
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

function open() {
  if (showTooltip.value) return
  updatePosition()
  showTooltip.value = true
  attachListeners()
  ensureSkill()
}

function hide() {
  if (!showTooltip.value) return
  showTooltip.value = false
  detachListeners()
}

function scheduleHide() {
  clearHideTimer()
  hideTimer = setTimeout(hide, 150)
}

function onMouseEnter() {
  clearHideTimer()
  if (showTooltip.value) return
  hoverTimer = setTimeout(open, 400)
}

function onMouseLeave() {
  clearHoverTimer()
  scheduleHide()
}

function toggle() {
  clearHoverTimer()
  clearHideTimer()
  if (showTooltip.value) hide()
  else open()
}

function onPopupEnter() {
  clearHoverTimer()
  clearHideTimer()
}

function onPopupLeave() {
  scheduleHide()
}

watch(
  () => props.userId,
  () => {
    fetchedUserId = null
    skill.value = null
    failed.value = false
  },
)

onUnmounted(() => {
  clearHoverTimer()
  clearHideTimer()
  detachListeners()
})
</script>

<template>
  <button
    ref="triggerRef"
    type="button"
    class="ap-next-tip"
    aria-label="Raw AP needed to raise your total AP by 1"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @click.stop="toggle"
    @keydown.escape="hide"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>

    <Teleport to="body">
      <Transition name="ap-next-tip">
        <div
          v-if="showTooltip"
          ref="popupRef"
          class="ap-next-tip__popup"
          :style="tooltipStyle"
          role="tooltip"
          @mouseenter="onPopupEnter"
          @mouseleave="onPopupLeave"
        >
          <div class="ap-next-tip__head">
            <span class="ap-next-tip__title">Next AP point</span>
            <span class="ap-next-tip__sub">Raw AP needed to raise your total AP by 1.</span>
          </div>

          <div v-if="loading" class="ap-next-tip__body">
            <div class="ap-next-tip__skeleton" />
            <div class="ap-next-tip__skeleton" />
          </div>

          <div v-else-if="failed" class="ap-next-tip__empty">
            Couldn't load skill data.
          </div>

          <ul v-else-if="categoryRows.length" class="ap-next-tip__rows">
            <li v-for="row in categoryRows" :key="row.code" class="ap-next-tip__row">
              <span class="ap-next-tip__name">{{ row.name }}</span>
              <span class="ap-next-tip__value" :style="{ color: row.accent }">
                {{ formatAp(row.ap) }}
              </span>
            </li>
          </ul>

          <div v-else class="ap-next-tip__empty">
            No ranked activity yet.
          </div>
        </div>
      </Transition>
    </Teleport>
  </button>
</template>

<style scoped>
.ap-next-tip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: help;
  line-height: 0;
  transition: color 120ms ease;
}

.ap-next-tip:hover,
.ap-next-tip:focus-visible {
  color: var(--accent);
  outline: none;
}
</style>

<style>
.ap-next-tip__popup {
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  pointer-events: auto;
}

.ap-next-tip__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ap-next-tip__title {
  font-size: var(--text-caption);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

.ap-next-tip__sub {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  line-height: 1.4;
}

.ap-next-tip__rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.ap-next-tip__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

.ap-next-tip__name {
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.ap-next-tip__value {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  font-weight: 500;
  white-space: nowrap;
}

.ap-next-tip__empty {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.ap-next-tip__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.ap-next-tip__skeleton {
  height: 14px;
  border-radius: 3px;
  background: var(--bg-overlay);
  animation: ap-next-tip-shimmer 1.5s ease-in-out infinite;
}

.ap-next-tip__skeleton:nth-child(2) {
  width: 70%;
}

@keyframes ap-next-tip-shimmer {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.85; }
}

.ap-next-tip-enter-active {
  transition: opacity 150ms ease-out, transform 150ms ease-out;
}

.ap-next-tip-leave-active {
  transition: opacity 100ms ease-in, transform 100ms ease-in;
}

.ap-next-tip-enter-from,
.ap-next-tip-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .ap-next-tip__skeleton {
    animation: none;
  }

  .ap-next-tip-enter-from,
  .ap-next-tip-leave-to {
    transform: none;
  }
}
</style>
