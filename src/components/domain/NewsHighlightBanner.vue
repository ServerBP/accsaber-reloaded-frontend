<script setup lang="ts">
import BaseBanner from '@/components/common/BaseBanner.vue'
import type { PublicNewsResponse } from '@/types/api/news'
import { NEWS_TYPE_ACCENT } from '@/utils/constants'
import { computed, onMounted, ref } from 'vue'

const DISMISS_KEY = 'accsaber:news-banner-dismissed'
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000

const news = ref<PublicNewsResponse | null>(null)
const dismissed = ref(false)

function isDismissed(id: string): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === id
  } catch {
    return false
  }
}

function markDismissed(id: string) {
  try {
    localStorage.setItem(DISMISS_KEY, id)
  } catch {
  }
}

function isRecent(iso: string | null): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < WINDOW_MS
}

const accent = computed(() => (news.value ? NEWS_TYPE_ACCENT[news.value.type] : 'var(--accent)'))
const target = computed(() => (news.value ? `/news/${news.value.slug}` : '/news'))
const visible = computed(() => news.value !== null && !dismissed.value)

function dismiss() {
  if (news.value) markDismissed(news.value.id)
  dismissed.value = true
}

onMounted(async () => {
  try {
    const { getNews } = await import('@/api/news')
    const res = await getNews({ size: 1, page: 0 })
    const latest = res.content[0]
    if (!latest || !isRecent(latest.publishedAt)) return
    if (isDismissed(latest.id)) return
    news.value = latest
  } catch {
  }
})
</script>

<template>
  <BaseBanner v-if="visible && news" class="news-banner" :style="{ '--banner-accent': accent }" role="status"
    @close="dismiss">
    <template #icon>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 11l18-8v18L3 13z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </svg>
    </template>

    <router-link :to="target" class="news-banner__link">
      <span class="news-banner__title">{{ news.title }}</span>
      <p v-if="news.description" class="news-banner__desc">{{ news.description }}</p>
    </router-link>
  </BaseBanner>
</template>

<style scoped>
.news-banner {
  background: var(--bg-surface);
  border-color: color-mix(in srgb, var(--banner-accent) 25%, var(--bg-overlay));
}

.news-banner__link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  text-decoration: none;
  color: inherit;
  width: 100%;
}

.news-banner__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.01em;
}

.news-banner__desc {
  margin: 0;
  font-size: var(--text-body);
  color: var(--text-primary);
  opacity: 0.92;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
