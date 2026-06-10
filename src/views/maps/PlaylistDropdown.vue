<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseDropdown from '@/components/common/BaseDropdown.vue'
import { usePlaylistDownload } from '@/composables/usePlaylistDownload'
import { useAuthStore } from '@/stores/auth'
import { ref } from 'vue'

const authStore = useAuthStore()
const open = ref(false)
const unplayedOnly = ref(false)
const { playlistCategories, downloadPlaylist: dlPlaylist, downloadMissingPlaylist: dlMissingPlaylist } =
  usePlaylistDownload()

function download(categoryCode: string) {
  if (unplayedOnly.value && authStore.userId) {
    dlMissingPlaylist(authStore.userId, categoryCode)
  } else {
    dlPlaylist(categoryCode)
  }
  open.value = false
}
</script>

<template>
  <BaseDropdown :open="open" @update:open="open = $event">
    <template #trigger>
      <button class="playlist-btn" :class="{ 'playlist-btn--active': open }" aria-label="Download playlists">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>Playlists</span>
        <svg class="playlist-chevron" :class="{ 'playlist-chevron--open': open }" width="12" height="12"
          viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
      </button>
    </template>
    <div class="playlist-menu">
      <span class="playlist-title">Download playlists...</span>
      <label v-if="authStore.isLoggedIn" class="playlist-toggle">
        <input v-model="unplayedOnly" type="checkbox" class="playlist-checkbox" />
        <span>Only your unplayed maps</span>
      </label>
      <BaseButton v-for="cat in playlistCategories" :key="cat.code" size="sm" @click="download(cat.code)">
        <span class="playlist-cat-dot" :style="{ background: cat.accent }" />
        {{ cat.name }}
      </BaseButton>
    </div>
  </BaseDropdown>
</template>

<style scoped>
.playlist-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  min-width: 140px;
  white-space: nowrap;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
}

.playlist-btn:hover,
.playlist-btn--active {
  background: color-mix(in srgb, var(--accent-overall) 22%, var(--bg-base));
}

.playlist-chevron {
  color: currentColor;
  transition: transform 150ms ease;
}

.playlist-chevron--open {
  transform: rotate(180deg);
}

.playlist-menu {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 200px;
}

.playlist-title {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  padding: var(--space-xs) var(--space-sm);
  font-weight: 500;
}

.playlist-cat-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.playlist-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--text-caption);
  color: var(--text-primary);
  cursor: pointer;
}

.playlist-checkbox {
  accent-color: var(--accent);
  cursor: pointer;
}
</style>
