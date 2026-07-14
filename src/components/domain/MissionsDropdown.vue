<script setup lang="ts">
import { useClickOutside } from '@/composables/useClickOutside'
import type { MissionResponse } from '@/types/api/missions'
import { defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const MissionsPanel = defineAsyncComponent(() => import('@/components/domain/MissionsPanel.vue'))

async function loadActive(): Promise<MissionResponse[]> {
  const { getMyMissions } = await import('@/api/missions')
  return getMyMissions()
}

async function loadHistory(): Promise<MissionResponse[]> {
  const { getMyCompletedMissions } = await import('@/api/missions')
  return getMyCompletedMissions()
}

const open = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

function updatePosition() {
  const trigger = triggerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  const isNarrow = window.matchMedia('(max-width: 600px)').matches
  if (isNarrow) {
    panelStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: '16px',
      right: '16px',
      width: 'auto',
      maxWidth: 'none',
    }
  } else {
    panelStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      right: `${Math.max(window.innerWidth - rect.right, 8)}px`,
      width: 'min(440px, calc(100vw - 32px))',
    }
  }
}

function onViewportChange() {
  if (open.value) updatePosition()
}

useClickOutside(panelRef, open, () => { open.value = false }, { ignoreRefs: [triggerRef] })

watch(open, async (value) => {
  if (value) {
    await nextTick()
    updatePosition()
  }
})

onMounted(() => {
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

onUnmounted(() => {
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})

function toggle() {
  open.value = !open.value
}

function handleNavigate() {
  open.value = false
}
</script>

<template>
  <button
    ref="triggerRef"
    type="button"
    class="navbar__icon-btn missions-trigger"
    :class="{ 'missions-trigger--active': open }"
    aria-label="Missions"
    @click="toggle"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  </button>

  <Teleport to="body">
    <Transition name="missions-dropdown">
      <div v-if="open" ref="panelRef" class="missions-dropdown-panel" :style="panelStyle">
        <MissionsPanel
          :active="open"
          :load-active="loadActive"
          :load-history="loadHistory"
          @navigate="handleNavigate"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.missions-trigger--active {
  color: var(--text-primary);
  background: var(--bg-elevated);
}
</style>

<style>
.missions-dropdown-panel {
  z-index: 200;
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  max-height: calc(100vh - var(--navbar-height) - 24px);
  overflow: hidden;
}

.missions-dropdown-enter-active,
.missions-dropdown-leave-active {
  transition: opacity 100ms ease, transform 100ms ease;
}

.missions-dropdown-enter-from,
.missions-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .missions-dropdown-enter-active,
  .missions-dropdown-leave-active {
    transition: none;
  }
}
</style>
