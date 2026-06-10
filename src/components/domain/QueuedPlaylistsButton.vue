<script setup lang="ts">
import BaseDropdown from '@/components/common/BaseDropdown.vue'
import { usePlaylistDownload } from '@/composables/usePlaylistDownload'
import { computed, ref } from 'vue'

const open = ref(false)
const { playlistCategories, downloadUnrankedPlaylist } = usePlaylistDownload()

const overallPlaylist = computed(() => playlistCategories.value.find((c) => c.code === 'overall'))
const otherPlaylists = computed(() => playlistCategories.value.filter((c) => c.code !== 'overall'))

function handleDownload(categoryCode: string) {
  downloadUnrankedPlaylist(categoryCode)
  open.value = false
}
</script>

<template>
  <BaseDropdown :open="open" @update:open="open = $event">
    <template #trigger>
      <button class="queued-playlists__btn" :class="{ 'queued-playlists__btn--active': open }"
        aria-label="Download queued playlists">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>Queued Playlists</span>
        <svg class="queued-playlists__chevron" :class="{ 'queued-playlists__chevron--open': open }" width="12"
          height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
      </button>
    </template>
    <div class="queued-playlists__menu">
      <span class="queued-playlists__title">Download queued playlists...</span>
      <button v-if="overallPlaylist" class="queued-playlists__primary"
        :style="{ '--primary-accent': overallPlaylist.accent }" @click="handleDownload(overallPlaylist.code)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span class="queued-playlists__primary-label">Download all queued maps</span>
      </button>
      <div v-if="otherPlaylists.length" class="queued-playlists__divider" />
      <span v-if="otherPlaylists.length" class="queued-playlists__subtitle">By category</span>
      <button v-for="cat in otherPlaylists" :key="cat.code" class="queued-playlists__item"
        @click="handleDownload(cat.code)">
        <span class="queued-playlists__cat-dot" :style="{ background: cat.accent }" />
        {{ cat.name }}
      </button>
    </div>
  </BaseDropdown>
</template>

<style scoped>
.queued-playlists__btn {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: color-mix(in srgb, var(--accent-overall) 12%, transparent);
  border: 1px solid var(--accent-overall);
  border-radius: var(--radius-input);
  color: var(--accent-overall);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms ease, box-shadow 120ms ease;
}

.queued-playlists__btn:hover,
.queued-playlists__btn--active {
  background: color-mix(in srgb, var(--accent-overall) 22%, var(--bg-base));
}

.queued-playlists__chevron {
  color: currentColor;
  transition: transform 150ms ease;
}

.queued-playlists__chevron--open {
  transform: rotate(180deg);
}

.queued-playlists__menu {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 240px;
}

.queued-playlists__title {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  padding: var(--space-xs) var(--space-sm);
  font-weight: 500;
}

.queued-playlists__subtitle {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  padding: 0 var(--space-sm);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}

.queued-playlists__divider {
  height: 1px;
  background: var(--bg-overlay);
  margin: var(--space-xs) 0;
}

.queued-playlists__primary {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: color-mix(in srgb, var(--primary-accent) 18%, transparent);
  border: 1px solid var(--primary-accent);
  border-radius: var(--radius-btn);
  color: var(--primary-accent);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: background 120ms ease, box-shadow 120ms ease;
}

.queued-playlists__primary:hover {
  background: color-mix(in srgb, var(--primary-accent) 28%, var(--bg-base));
}

.queued-playlists__primary-label {
  flex: 1;
}

.queued-playlists__item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  background: transparent;
  border: none;
  border-radius: var(--radius-btn);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  cursor: pointer;
  text-align: left;
  transition: background 120ms ease;
}

.queued-playlists__item:hover {
  background: var(--bg-elevated);
}

.queued-playlists__cat-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
