<script setup lang="ts">
import GlintOverlay from '@/components/common/GlintOverlay.vue'
import ParticleCanvas from '@/components/common/ParticleCanvas.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { usePlaylistDownload } from '@/composables/usePlaylistDownload'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const { playlistCategories, downloadPlaylist } = usePlaylistDownload()

usePageMeta({
  title: 'Getting Started | AccSaber Reloaded',
  description: 'Learn how to get started with AccSaber and start competing on accuracy leaderboards.',
})
</script>

<template>
  <div class="gs">
    <ParticleCanvas class="gs__particles" :dark-mode="themeStore.resolvedBase === 'dark'" :particle-count="100" />

    <RouterLink to="/" class="gs__back">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      Home
    </RouterLink>

    <header class="gs__header" style="--step-delay: 0ms">
      <h1 class="gs__page-title">
        Getting Started
        <GlintOverlay />
      </h1>
      <p class="gs__page-sub">Three steps to the leaderboards.</p>
    </header>

    <section class="gs__step" style="--step-delay: 100ms">
      <div class="gs__node" aria-hidden="true"><span>1</span></div>
      <h2 class="gs__title">
        Install a Leaderboard Mod
        <GlintOverlay :count="3" />
      </h2>
      <p class="gs__prose">
        You need a mod to submit scores. Grab
        <a href="https://beatleader.com/" target="_blank" rel="noopener noreferrer" class="gs__link gs__link--primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          BeatLeader<span class="gs__rec">recommended</span></a>
        or
        <a href="https://scoresaber.com/" target="_blank" rel="noopener noreferrer" class="gs__link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          ScoreSaber</a>
        for your platform - PC or Quest.
      </p>
      <a
        href="https://github.com/not-dexter/accsaber-reloaded-plugin/releases"
        target="_blank"
        rel="noopener noreferrer"
        class="gs__plugin-btn"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>
          <span class="gs__plugin-btn-label">On PC? Download our new plugin</span>
          <span class="gs__plugin-btn-sub">accsaber-reloaded-plugin</span>
        </span>
      </a>
    </section>

    <div class="gs__connector" aria-hidden="true" />

    <section class="gs__step" style="--step-delay: 200ms">
      <div class="gs__node" aria-hidden="true"><span>2</span></div>
      <h2 class="gs__title">
        Download the Playlists
        <GlintOverlay :count="3" />
      </h2>
      <p class="gs__prose">
        Grab the ranked map playlists and drop them into your
        <code class="gs__code">Playlists</code> folder. Pick the categories you want to play.
      </p>
      <div class="gs__playlists">
        <button v-for="cat in playlistCategories" :key="cat.code" class="gs__chip"
          :style="{ '--chip-color': cat.accent }" @click="downloadPlaylist(cat.code)">
          <span class="gs__chip-dot" />
          <span>{{ cat.name }}</span>
          <svg class="gs__chip-dl" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      </div>
    </section>

    <div class="gs__connector" aria-hidden="true" />

    <section class="gs__step" style="--step-delay: 300ms">
      <div class="gs__node" aria-hidden="true"><span>3</span></div>
      <h2 class="gs__title">
        Play and See Results
        <GlintOverlay :count="3" />
      </h2>
      <p class="gs__prose">
        Play the maps from the playlists. Your scores are automatically submitted and will
        appear on the
        <RouterLink to="/leaderboards" class="gs__link gs__link--primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          leaderboards</RouterLink>.
        Browse all the
        <RouterLink to="/maps" class="gs__link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          ranked maps</RouterLink>
        to find your next challenge.
      </p>
    </section>
  </div>
</template>

<style scoped>
.gs {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
  padding: var(--space-3xl) var(--space-lg);
  min-height: 100vh;
}

.gs__particles {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.gs__back {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  align-self: flex-start;
  color: var(--text-tertiary);
  text-decoration: none;
  font-size: var(--text-caption);
  margin-bottom: var(--space-md);
  transition: color 120ms ease;
}

.gs__back:hover {
  color: var(--text-secondary);
}

.gs__header {
  position: relative;
  z-index: 1;
  text-align: center;
  margin-bottom: var(--space-3xl);
  animation: gs-enter 500ms ease-out both;
  animation-delay: var(--step-delay);
}

.gs__page-title {
  position: relative;
  display: inline-block;
  font-size: 2.25rem;
  font-weight: 700;
  margin: 0 0 var(--space-sm);
  color: var(--text-primary);
}

.gs__page-sub {
  font-size: var(--text-body);
  color: var(--text-secondary);
  margin: 0;
}

.gs__step {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-md);
  width: 100%;
  animation: gs-enter 500ms ease-out both;
  animation-delay: var(--step-delay);
}

@keyframes gs-enter {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.gs__node {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--accent-overall);
  background: var(--bg-base);
}

.gs__node span {
  font-family: var(--font-mono);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--accent-overall);
}

.gs__connector {
  position: relative;
  z-index: 1;
  width: 1px;
  height: 48px;
  background: var(--accent-overall);
  margin: var(--space-sm) 0;
}

.gs__title {
  position: relative;
  display: inline-block;
  font-size: var(--text-section-heading);
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.gs__prose {
  font-size: var(--text-body);
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0;
  max-width: 480px;
}

.gs__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--bg-overlay);
  background: var(--bg-surface);
  color: var(--text-primary);
  text-decoration: none;
  font-weight: 600;
  white-space: nowrap;
  vertical-align: baseline;
  transition: all 150ms ease;
}

.gs__link svg {
  flex-shrink: 0;
  opacity: 0.6;
}

.gs__link:hover {
  border-color: var(--text-tertiary);
  background: var(--bg-elevated);
}

.gs__link--primary {
  border-color: color-mix(in srgb, var(--accent-overall) 50%, transparent);
  background: color-mix(in srgb, var(--accent-overall) 8%, var(--bg-surface));
  color: var(--accent-overall);
}

.gs__link--primary svg {
  opacity: 0.8;
}

.gs__link--primary:hover {
  border-color: var(--accent-overall);
  background: color-mix(in srgb, var(--accent-overall) 15%, var(--bg-surface));
}

.gs__plugin-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-lg);
  margin-top: var(--space-sm);
  border-radius: var(--radius-pill);
  border: 1px solid color-mix(in srgb, var(--accent-true-acc) 50%, transparent);
  background: color-mix(in srgb, var(--accent-true-acc) 8%, var(--bg-surface));
  color: var(--accent-true-acc);
  text-decoration: none;
  font-weight: 600;
  transition: all 200ms ease;
}

.gs__plugin-btn svg {
  opacity: 0.85;
  flex-shrink: 0;
  transition: opacity 150ms ease;
}

.gs__plugin-btn:hover {
  border-color: var(--accent-true-acc);
  background: color-mix(in srgb, var(--accent-true-acc) 15%, var(--bg-surface));
}

.gs__plugin-btn:hover svg {
  opacity: 1;
}

.gs__plugin-btn span {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.2;
  text-align: left;
}

.gs__plugin-btn-label {
  font-size: var(--text-body);
}

.gs__plugin-btn-sub {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 500;
  opacity: 0.7;
  margin-top: 2px;
}

.gs__rec {
  font-size: 0.625rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
  margin-left: 2px;
}

.gs__code {
  font-family: var(--font-mono);
  font-size: 0.8125em;
  background: var(--bg-elevated);
  color: var(--text-primary);
  padding: 1px 6px;
  border-radius: var(--radius-btn);
}

.gs__playlists {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
  justify-content: center;
  margin-top: var(--space-xs);
}

.gs__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-pill);
  border: 1px solid color-mix(in srgb, var(--chip-color) 40%, var(--bg-overlay));
  background: color-mix(in srgb, var(--chip-color) 6%, var(--bg-surface));
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 150ms ease;
}

.gs__chip:hover {
  border-color: var(--chip-color);
  background: color-mix(in srgb, var(--chip-color) 14%, var(--bg-surface));
}

.gs__chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--chip-color);
}

.gs__chip-dl {
  opacity: 0.5;
  transition: opacity 150ms ease;
}

.gs__chip:hover .gs__chip-dl {
  opacity: 1;
}

@media (max-width: 767px) {
  .gs {
    padding: var(--space-2xl) var(--space-md);
  }

  .gs__page-title {
    font-size: 1.75rem;
  }

  .gs__header {
    margin-bottom: var(--space-2xl);
  }

  .gs__connector {
    height: 32px;
  }

  .gs__playlists {
    gap: var(--space-xs);
  }
}

@media (prefers-reduced-motion: reduce) {
  .gs__step,
  .gs__header {
    animation: none;
  }
}
</style>
