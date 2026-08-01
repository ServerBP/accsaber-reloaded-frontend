<script setup lang="ts">
import type { LevelThreshold } from '@/api/levels'
import ParticleCanvas from '@/components/common/ParticleCanvas.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import FollowedActivity from '@/components/domain/FollowedActivity.vue'
import NewsHighlightBanner from '@/components/domain/NewsHighlightBanner.vue'
import { useBrandLogo } from '@/composables/useBrandLogo'
import { usePageMeta } from '@/composables/usePageMeta'
import { useReducedMotion } from '@/composables/useReducedMotion'
import { useAuthStore } from '@/stores/auth'
import { tierKey, useLevelStore } from '@/stores/levels'
import { useThemeStore } from '@/stores/theme'
import { DISCORD_URL, KOFI_URL } from '@/utils/constants'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const themeStore = useThemeStore()
const levelStore = useLevelStore()
const authStore = useAuthStore()

const logoUrl = useBrandLogo()
const showHeroAmbience = computed(() => themeStore.activeTokens?.['fx-hero-particles'] !== '0')

const isLoggedIn = computed(() => authStore.isLoggedIn)
const displayName = computed(() => authStore.userProfile?.name ?? '')

usePageMeta({
  title: 'AccSaber',
  description: 'Accuracy-based leaderboard platform for Beat Saber.',
})

const levels = computed(() => levelStore.thresholds)
const levelsLoading = computed(() => !levelStore.loaded)
const reducedMotion = useReducedMotion()
const marqueeRef = ref<HTMLElement | null>(null)
let rafId = 0
let carouselObserver: IntersectionObserver | null = null
let carouselVisible = false
let mounted = false

function levelRange(level: number, index: number, all: LevelThreshold[]): string {
  const next = all[index + 1]
  if (!next) return `${level}+`
  return `${level}\u2013${next.level - 1}`
}

function canAnimateCarousel(): boolean {
  return mounted && carouselVisible && !reducedMotion.value && !document.hidden
}

function stopCarousel(): void {
  if (!rafId) return
  cancelAnimationFrame(rafId)
  rafId = 0
}

function scheduleCarousel(): void {
  if (!rafId && canAnimateCarousel()) rafId = requestAnimationFrame(updateCarousel)
}

function updateCarousel(): void {
  rafId = 0
  if (!canAnimateCarousel()) return

  const el = marqueeRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (rect.width === 0) return
  const center = rect.left + rect.width / 2
  const half = rect.width / 2

  for (const item of el.querySelectorAll<HTMLElement>('.xp-item')) {
    const ir = item.getBoundingClientRect()
    const dist = Math.abs(ir.left + ir.width / 2 - center) / half
    const edge = Math.max(0, (dist - 0.82) / 0.18)
    const t = 1 - edge * edge
    item.style.transform = `scale(${0.4 + 0.6 * t})`
    item.style.opacity = `${0.08 + 0.92 * t}`
  }

  scheduleCarousel()
}

function observeCarousel(el: HTMLElement | null): void {
  carouselObserver?.disconnect()
  carouselObserver = null
  carouselVisible = false
  stopCarousel()

  if (!el) return
  if (typeof IntersectionObserver === 'undefined') {
    carouselVisible = true
    scheduleCarousel()
    return
  }

  carouselObserver = new IntersectionObserver((entries) => {
    carouselVisible = entries.some((entry) => entry.isIntersecting)
    if (carouselVisible) scheduleCarousel()
    else stopCarousel()
  })
  carouselObserver.observe(el)
}

function handleVisibilityChange(): void {
  if (document.hidden) stopCarousel()
  else scheduleCarousel()
}

watch(marqueeRef, observeCarousel, { flush: 'post' })
watch(reducedMotion, (reduced) => {
  if (reduced) stopCarousel()
  else scheduleCarousel()
})

onMounted(() => {
  mounted = true
  document.addEventListener('visibilitychange', handleVisibilityChange)
  if (!levelStore.loaded) void levelStore.fetchThresholds()
  scheduleCarousel()
})

onUnmounted(() => {
  mounted = false
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  carouselObserver?.disconnect()
  carouselObserver = null
  stopCarousel()
})
</script>

<template>
  <div class="home" :class="{ 'home--dashboard': isLoggedIn }">
    <section class="hero" :class="{ 'hero--compact': isLoggedIn }">
      <div class="hero__banner-slot">
        <NewsHighlightBanner />
      </div>
      <div v-if="showHeroAmbience" class="hero__glow" />
      <ParticleCanvas
        v-if="showHeroAmbience"
        class="hero__particles"
        :dark-mode="themeStore.resolvedBase === 'dark'"
        :interactive="!isLoggedIn"
      />

      <div class="hero__content">
        <div class="hero__identity">
          <div class="hero__logo-block">
            <div class="hero__logo-wrap">
              <img
                :src="logoUrl"
                alt="AccSaber"
                class="hero__logo"
                fetchpriority="high"
                decoding="async"
              />
            </div>
          </div>
          <div class="hero__intro">
            <p class="hero__tagline">
              <template v-if="isLoggedIn">
                Welcome back, <span class="hero__name">{{ displayName }}</span>
              </template>
              <template v-else>New and improved stack for AccSaber.</template>
            </p>
          </div>
        </div>

        <div class="hero__cta">
          <div v-if="isLoggedIn" class="hero__mini-stats">
            <span class="hero__mini-stat"><strong>128K+</strong> Players</span>
            <span class="hero__mini-sep" aria-hidden="true">·</span>
            <span class="hero__mini-stat"><strong>540+</strong> Ranked Maps</span>
          </div>
          <div class="hero__cta-buttons">
            <div class="hero__actions">
              <RouterLink to="/getting-started" class="hero__get-started">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Get Started
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </RouterLink>
              <a
                href="https://github.com/not-dexter/accsaber-reloaded-plugin/releases"
                target="_blank"
                rel="noopener noreferrer"
                class="hero__plugin"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Plugin
                <span class="hero__plugin-tag">PC</span>
              </a>
            </div>
            <div class="hero__community">
              <a
                :href="DISCORD_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="hero__discord"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
                  />
                </svg>
                Join Discord
              </a>
              <a :href="KOFI_URL" target="_blank" rel="noopener noreferrer" class="hero__kofi">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
                  <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
                  <line x1="6" y1="2" x2="6" y2="4" />
                  <line x1="10" y1="2" x2="10" y2="4" />
                  <line x1="14" y1="2" x2="14" y2="4" />
                </svg>
                Support on Ko-fi
              </a>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!isLoggedIn" class="hero__stats">
        <div class="hero__stat">
          <span class="hero__stat-value">128K+</span>
          <span class="hero__stat-label">Total Players</span>
        </div>
        <div class="hero__stat">
          <span class="hero__stat-value">540+</span>
          <span class="hero__stat-label">Ranked Maps</span>
        </div>
      </div>

      <div v-if="isLoggedIn" class="hero__activity">
        <FollowedActivity />
      </div>

      <div v-if="!isLoggedIn" class="hero__scroll-hint" aria-hidden="true">
        <svg
          class="hero__scroll-arrow"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="7 13 12 18 17 13" />
          <polyline points="7 6 12 11 17 6" />
        </svg>
      </div>
    </section>

    <section class="section xp-section">
      <h2 class="section__title">The XP System</h2>
      <p class="xp-section__intro">
        While <strong>AP</strong> rewards the <em>quality</em> of your play,
        <strong>XP</strong> rewards <em>participation</em>. Play more ranked maps, earn milestones,
        improve your scores. Quality still matters, but the biggest factor is showing up.
      </p>

      <div v-if="levelsLoading" class="xp-skeleton">
        <SkeletonLoader v-for="i in 7" :key="i" width="72px" height="52px" />
      </div>

      <div v-else-if="levels.length > 0" ref="marqueeRef" class="xp-marquee">
        <div class="xp-marquee__track">
          <template v-for="copy in 2" :key="copy">
            <template v-for="(tier, i) in levels" :key="`${copy}-${tier.level}`">
              <div class="xp-item xp-tier">
                <div
                  class="xp-tier__node"
                  :style="{
                    background: `var(--tier-${tierKey(tier.title)})`,
                    boxShadow: `0 0 10px var(--tier-${tierKey(tier.title)})`,
                  }"
                />
                <span
                  class="xp-tier__title"
                  :style="{ color: `var(--tier-${tierKey(tier.title)})` }"
                >
                  {{ tier.title }}
                </span>
                <span class="xp-tier__range">Lv. {{ levelRange(tier.level, i, levels) }}</span>
              </div>

              <svg
                v-if="i < levels.length - 1"
                class="xp-item xp-tier__arrow"
                viewBox="0 0 40 16"
                fill="none"
                aria-hidden="true"
              >
                <line
                  x1="0"
                  y1="8"
                  x2="32"
                  y2="8"
                  :stroke="`var(--tier-${tierKey(tier.title)})`"
                  stroke-width="2"
                />
                <polygon :points="`40,8 32,3 32,13`" :fill="`var(--tier-${tierKey(tier.title)})`" />
              </svg>
            </template>

            <div class="xp-item xp-divider" />
          </template>
        </div>
      </div>
    </section>

    <footer class="home-footer">
      <p class="home-footer__text">Logo by Brylanbbab and Interz.</p>
      <nav class="home-footer__links" aria-label="Footer links">
        <a
          href="https://github.com/tikugato/accsaber-reloaded-frontend"
          target="_blank"
          rel="noopener noreferrer"
          class="home-footer__link"
        >
          GitHub
        </a>
        <span class="home-footer__sep" aria-hidden="true">·</span>
        <RouterLink to="/score-feed" class="home-footer__link">Score Feed</RouterLink>
        <span class="home-footer__sep" aria-hidden="true">·</span>
        <RouterLink to="/credits" class="home-footer__link">Credits</RouterLink>
      </nav>
    </footer>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xl);
  max-width: 1030px;
  margin: 0 auto;
  width: 100%;
  padding-bottom: var(--space-3xl);
}

.hero {
  position: relative;
  min-height: calc(100svh + var(--space-xl));
  margin-top: calc((var(--navbar-height) + var(--space-xl)) * -1);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-xl);
  padding: calc(var(--navbar-height) + var(--space-md)) var(--space-md) var(--space-3xl);
  overflow: hidden;
}

.hero__banner-slot {
  position: absolute;
  top: calc(var(--navbar-height) + var(--space-md));
  left: 0;
  right: 0;
  z-index: 60;
  padding: 0 var(--space-md);
  pointer-events: none;
}

.hero__banner-slot > * {
  pointer-events: auto;
  margin-bottom: 0;
}

.hero__glow {
  position: absolute;
  inset: -32px -64px 0 -64px;
  background: radial-gradient(
    ellipse at 50% 0%,
    color-mix(in srgb, var(--tier-gold) 12%, transparent),
    transparent 70%
  );
  pointer-events: none;
  z-index: 0;
}

.hero__particles {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.hero__content {
  position: relative;
  z-index: 2;
  margin-top: var(--space-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xl);
  text-align: center;
  width: 100%;
}

.hero__identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.hero__logo-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}

.hero__logo-wrap {
  position: relative;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.hero__logo {
  position: relative;
  z-index: 1;
  width: 120px;
  height: 120px;
  object-fit: contain;
}

.hero__intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}

.hero__tagline {
  font-size: var(--text-section-heading);
  color: var(--text-secondary);
  margin: 0;
}

.hero__name {
  color: var(--accent-overall);
  font-weight: 700;
  text-shadow: 0 0 18px color-mix(in srgb, var(--accent-overall) 45%, transparent);
}

.hero__mini-stats {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.hero__mini-stat strong {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--text-primary);
}

.hero__mini-sep {
  opacity: 0.5;
}

.hero__cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.hero__cta-buttons {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

/* ---- Compact dashboard hero (logged in) ---- */
.hero--compact {
  justify-content: flex-start;
  align-items: stretch;
  gap: var(--space-xl);
  padding-top: calc(var(--navbar-height) + var(--space-2xl) + var(--space-xl));
  padding-bottom: var(--space-xl);
  overflow: visible;
}

.hero--compact .hero__glow {
  position: fixed;
  inset: -32px 0 0 0;
  width: auto;
  height: auto;
  transform: none;
  z-index: -1;
  background: radial-gradient(
    ellipse at 50% 0%,
    color-mix(in srgb, var(--tier-gold) 12%, transparent),
    transparent 70%
  );
}

.hero--compact .hero__content {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  margin-top: 0;
  text-align: left;
}

.hero--compact .hero__identity {
  flex-direction: row;
  align-items: center;
  gap: var(--space-lg);
}

.hero--compact .hero__logo {
  width: 156px;
  height: 156px;
}

.hero--compact .hero__intro {
  align-items: flex-start;
  justify-content: center;
  gap: var(--space-xs);
}

.hero--compact .hero__tagline {
  font-size: var(--text-page-title);
  color: var(--text-primary);
  font-weight: 700;
}

.hero--compact .hero__cta {
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-sm);
}

.hero--compact .hero__cta-buttons {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: stretch;
  gap: var(--space-md);
}

.hero--compact .hero__actions,
.hero--compact .hero__community {
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-sm);
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--space-md);
}

.hero__get-started {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-xl);
  border-radius: var(--radius-pill);
  border: 1px solid color-mix(in srgb, var(--accent-overall) 50%, transparent);
  background: color-mix(in srgb, var(--accent-overall) 8%, var(--bg-surface));
  color: var(--accent-overall);
  text-decoration: none;
  font-weight: 600;
  font-size: var(--text-body);
  letter-spacing: 0.01em;
  transition: all 200ms ease;
}

.hero__plugin {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-xl);
  border-radius: var(--radius-pill);
  border: 1px solid color-mix(in srgb, var(--accent-true-acc) 50%, transparent);
  background: color-mix(in srgb, var(--accent-true-acc) 8%, var(--bg-surface));
  color: var(--accent-true-acc);
  text-decoration: none;
  font-weight: 600;
  font-size: var(--text-body);
  letter-spacing: 0.01em;
  transition: all 200ms ease;
}

.hero__plugin svg {
  opacity: 0.8;
  flex-shrink: 0;
  transition: opacity 150ms ease;
}

.hero__plugin:hover {
  border-color: var(--accent-true-acc);
  background: color-mix(in srgb, var(--accent-true-acc) 15%, var(--bg-surface));
  box-shadow: 0 0 20px color-mix(in srgb, var(--accent-true-acc) 35%, transparent);
}

.hero__plugin:hover svg {
  opacity: 1;
}

.hero__plugin-tag {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 2px 6px;
  border-radius: var(--radius-btn);
  background: color-mix(in srgb, var(--accent-true-acc) 20%, transparent);
  color: var(--accent-true-acc);
  opacity: 0.9;
}

.hero__get-started svg {
  opacity: 0.7;
  transition: opacity 150ms ease;
}

.hero__get-started:hover {
  border-color: var(--accent-overall);
  background: color-mix(in srgb, var(--accent-overall) 15%, var(--bg-surface));
  box-shadow: 0 0 20px color-mix(in srgb, var(--accent-overall) 35%, transparent);
}

.hero__get-started:hover svg {
  opacity: 1;
}

.hero__community {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-md);
}

.hero__discord {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-xl);
  border-radius: var(--radius-pill);
  border: 1px solid var(--bg-overlay);
  background: var(--bg-surface);
  color: var(--text-primary);
  text-decoration: none;
  font-weight: 600;
  font-size: var(--text-body);
  transition: all 200ms ease;
}

.hero__discord svg {
  opacity: 0.6;
  flex-shrink: 0;
  transition: opacity 150ms ease;
}

.hero__discord:hover {
  border-color: var(--text-tertiary);
  background: var(--bg-elevated);
  box-shadow: 0 0 14px color-mix(in srgb, var(--accent-overall) 20%, transparent);
}

.hero__discord:hover svg {
  opacity: 1;
}

.hero__kofi {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-pill);
  border: 1px solid var(--bg-overlay);
  background: var(--bg-surface);
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.8125rem;
  transition: all 200ms ease;
}

.hero__kofi svg {
  opacity: 0.55;
  flex-shrink: 0;
  transition:
    opacity 150ms ease,
    color 150ms ease;
}

.hero__kofi:hover {
  border-color: color-mix(in srgb, #d96a2c 50%, var(--bg-overlay));
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.hero__kofi:hover svg {
  opacity: 1;
  color: #ffd6a8;
}

.hero__stats {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: center;
  gap: var(--space-2xl);
  flex-wrap: wrap;
}

.hero__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}

.hero__stat-value {
  font-family: var(--font-mono);
  font-size: var(--text-section-heading);
  font-weight: 600;
  color: var(--text-primary);
}

.hero__stat-label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.hero__scroll-hint {
  position: absolute;
  top: calc(100svh - var(--space-2xl));
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  animation: scroll-float 2s ease-in-out infinite;
}

.hero__scroll-arrow {
  color: var(--accent-overall);
}

@media (max-height: 720px) {
  .hero__scroll-hint {
    display: none;
  }
}

@keyframes scroll-float {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
    opacity: 0.7;
  }

  50% {
    transform: translateX(-50%) translateY(8px);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero__scroll-hint {
    animation: none;
  }
}

.section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
}

.section__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.xp-section {
  padding: 0 var(--space-md);
}

.xp-section__intro {
  max-width: 560px;
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--text-body);
  line-height: 1.6;
  margin: 0;
}

.xp-section__intro strong {
  color: var(--text-primary);
  font-weight: 700;
}

.xp-skeleton {
  display: flex;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-xl) 0;
  width: 100%;
  overflow: hidden;
}

.xp-marquee {
  width: 100%;
  overflow: hidden;
  padding: var(--space-xl) 0;
}

.xp-marquee__track {
  display: flex;
  align-items: center;
  width: max-content;
  animation: xp-scroll 18s linear infinite;
}

.xp-marquee:hover .xp-marquee__track {
  animation-play-state: paused;
}

@keyframes xp-scroll {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-50%);
  }
}

.xp-item {
  will-change: transform, opacity;
  flex-shrink: 0;
}

.xp-tier {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  min-width: 72px;
  padding: 0 var(--space-xs);
}

.xp-tier__node {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--bg-base);
}

.xp-tier__arrow {
  width: 32px;
  height: 16px;
  align-self: center;
}

.xp-tier__title {
  font-weight: 700;
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.xp-tier__range {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.xp-divider {
  width: 1px;
  height: 48px;
  background: var(--bg-overlay);
  margin: 0 var(--space-lg);
  align-self: center;
}

.home-footer {
  text-align: center;
  padding: var(--space-xl) var(--space-md);
  border-top: 1px solid var(--bg-overlay);
}

.home-footer__text {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  margin: 0;
  line-height: 1.5;
}

.home-footer__links {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
  font-size: var(--text-caption);
}

.home-footer__link {
  color: var(--text-tertiary);
  text-decoration: none;
  transition: color 150ms ease;
}

.home-footer__link:hover,
.home-footer__link:focus-visible {
  color: var(--text-secondary);
}

.home-footer__sep {
  color: var(--text-tertiary);
  opacity: 0.55;
}

@media (prefers-reduced-motion: reduce) {
  .xp-marquee__track {
    animation: none;
  }
}

@media (max-width: 767px) {
  .hero {
    margin-top: calc((var(--navbar-height) + var(--space-md)) * -1);
    padding: calc(var(--navbar-height) + var(--space-md)) var(--space-md) var(--space-2xl);
  }

  .hero__logo {
    width: 80px;
    height: 80px;
  }

  .hero__tagline {
    font-size: var(--text-body);
  }

  .hero__stats {
    gap: var(--space-md);
  }

  .hero__scroll-hint {
    display: none;
  }

  .hero__get-started,
  .hero__plugin,
  .hero__discord,
  .hero__kofi {
    padding: var(--space-sm) var(--space-lg);
    max-width: 100%;
  }

  .hero--compact .hero__content {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-lg);
  }

  .hero--compact .hero__identity {
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
  }

  .hero--compact .hero__intro {
    align-items: center;
  }

  .hero--compact .hero__logo {
    width: 96px;
    height: 96px;
  }

  .hero--compact .hero__tagline {
    font-size: var(--text-section-heading);
  }

  .hero--compact .hero__cta {
    align-items: center;
  }

  .hero--compact .hero__cta-buttons {
    flex-direction: column;
    align-items: center;
  }

  .hero--compact .hero__actions,
  .hero--compact .hero__community {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
  }
}
</style>
