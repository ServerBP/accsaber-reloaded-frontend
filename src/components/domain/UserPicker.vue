<script setup lang="ts">
import CountryFlag from '@/components/domain/CountryFlag.vue'
import { useDebouncedRef } from '@/composables/useDebouncedRef'
import { onAvatarError, pickAvatarFallback, pickAvatarUrl } from '@/composables/useAvatarFallback'
import { getUser } from '@/api/users'
import { useCategoryStore } from '@/stores/categories'
import type { LeaderboardResponse } from '@/types/api/users'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string | null
  placeholder?: string
  disabled?: boolean
}>(), {
  placeholder: 'Search players by name...',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const categoryStore = useCategoryStore()

const MIN_CHARS = 2
const PAGE_SIZE = 12

const search = ref('')
const debounced = useDebouncedRef(search, 200)
const results = ref<LeaderboardResponse[]>([])
const loading = ref(false)
const open = ref(false)
const focusedIndex = ref(-1)
const selected = ref<{ userId: string; userName: string; country: string; avatarUrl: string; avatarFallbackUrl: string | null } | null>(null)

const containerRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

let requestId = 0

const showResults = computed(() => open.value && debounced.value.trim().length >= MIN_CHARS)

async function runSearch(query: string) {
  const id = ++requestId
  const overall = categoryStore.byCode.get('overall')?.id
  if (!overall) return
  loading.value = true
  try {
    const { getLeaderboard } = await import('@/api/leaderboards')
    const page = await getLeaderboard(overall, {
      page: 0,
      size: PAGE_SIZE,
      search: query,
      sort: 'ranking,ASC',
    })
    if (id !== requestId) return
    results.value = page.content
    focusedIndex.value = page.content.length > 0 ? 0 : -1
  } catch {
    if (id === requestId) results.value = []
  } finally {
    if (id === requestId) loading.value = false
  }
}

function updatePanelPosition() {
  const trigger = containerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  panelStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    minWidth: `${rect.width}px`,
  }
}

function pick(user: LeaderboardResponse) {
  selected.value = {
    userId: user.userId,
    userName: user.userName,
    country: user.country,
    avatarUrl: pickAvatarUrl(user),
    avatarFallbackUrl: pickAvatarFallback(user),
  }
  emit('update:modelValue', user.userId)
  open.value = false
  search.value = ''
}

function clear() {
  selected.value = null
  emit('update:modelValue', null)
  search.value = ''
  nextTick(() => inputRef.value?.focus())
}

function openPanel() {
  open.value = true
  updatePanelPosition()
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as Node
  if (!target.isConnected) return
  if (containerRef.value?.contains(target)) return
  open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (!showResults.value) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    focusedIndex.value = Math.min(results.value.length - 1, focusedIndex.value + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    focusedIndex.value = Math.max(0, focusedIndex.value - 1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const choice = results.value[focusedIndex.value]
    if (choice) pick(choice)
  } else if (e.key === 'Escape') {
    open.value = false
  }
}

watch(debounced, (val) => {
  const trimmed = val.trim()
  if (trimmed.length < MIN_CHARS) {
    results.value = []
    return
  }
  runSearch(trimmed)
})

watch(() => props.modelValue, async (val) => {
  if (!val) {
    selected.value = null
    return
  }
  if (selected.value?.userId === val) return
  try {
    const u = await getUser(val)
    selected.value = {
      userId: u.id,
      userName: u.name,
      country: u.country,
      avatarUrl: pickAvatarUrl(u),
      avatarFallbackUrl: pickAvatarFallback(u),
    }
  } catch {
    selected.value = null
  }
}, { immediate: true })

function onReposition() {
  if (open.value) updatePanelPosition()
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  window.addEventListener('scroll', onReposition, true)
  window.addEventListener('resize', onReposition)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  window.removeEventListener('scroll', onReposition, true)
  window.removeEventListener('resize', onReposition)
})
</script>

<template>
  <div ref="containerRef" class="user-picker">
    <div v-if="selected" class="user-picker__selected">
      <img v-if="selected.avatarUrl" class="user-picker__avatar" :src="selected.avatarUrl" :alt="selected.userName"
        loading="lazy" decoding="async" @error="onAvatarError(selected.avatarFallbackUrl)($event)" />
      <CountryFlag v-if="selected.country" :country="selected.country" />
      <span class="user-picker__name">{{ selected.userName }}</span>
      <button type="button" class="user-picker__clear" :disabled="disabled" aria-label="Clear selection" @click="clear">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <input
      v-else
      ref="inputRef"
      v-model="search"
      type="text"
      class="user-picker__input"
      :placeholder="placeholder"
      :disabled="disabled"
      @focus="openPanel"
      @input="openPanel"
      @keydown="onKeydown"
    />

    <Teleport to="body">
      <div v-if="showResults" class="user-picker__panel" :style="panelStyle">
        <div v-if="loading" class="user-picker__status">Searching...</div>
        <div v-else-if="results.length === 0" class="user-picker__status">No players found</div>
        <button
          v-for="(user, i) in results"
          :key="user.userId"
          type="button"
          class="user-picker__option"
          :class="{ 'user-picker__option--focused': i === focusedIndex }"
          @mouseenter="focusedIndex = i"
          @click="pick(user)"
        >
          <img v-if="user.cdnAvatarUrl || user.avatarUrl" class="user-picker__avatar"
            :src="user.cdnAvatarUrl ?? user.avatarUrl" :alt="user.userName" loading="lazy" decoding="async"
            @error="onAvatarError(user.cdnAvatarUrl && user.avatarUrl && user.cdnAvatarUrl !== user.avatarUrl ? user.avatarUrl : null)($event)" />
          <CountryFlag v-if="user.country" :country="user.country" />
          <span class="user-picker__option-name">{{ user.userName }}</span>
          <span class="user-picker__option-rank">#{{ user.ranking }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.user-picker {
  position: relative;
  width: 100%;
}

.user-picker__input {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  outline: none;
  transition: border-color 120ms ease;
}

.user-picker__input:focus {
  border-color: var(--accent);
}

.user-picker__input::placeholder {
  color: var(--text-tertiary);
}

.user-picker__selected {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
}

.user-picker__avatar {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-avatar);
  object-fit: cover;
}

.user-picker__name {
  flex: 1;
  font-size: var(--text-body);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-picker__clear {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-btn);
  transition: color 120ms ease;
}

.user-picker__clear:hover:not(:disabled) {
  color: var(--text-primary);
}
</style>

<style>
.user-picker__panel {
  z-index: 1000;
  background: var(--bg-elevated);
  border: 1px solid var(--text-tertiary);
  border-radius: var(--radius-card);
  overflow: hidden;
  max-height: 320px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.user-picker__status {
  padding: var(--space-md);
  color: var(--text-tertiary);
  font-size: var(--text-caption);
  text-align: center;
}

.user-picker__option {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  cursor: pointer;
  text-align: left;
  transition: background-color 80ms ease;
}

.user-picker__option--focused,
.user-picker__option:hover {
  background: var(--bg-overlay);
}

.user-picker__option-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-picker__option-rank {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}
</style>
