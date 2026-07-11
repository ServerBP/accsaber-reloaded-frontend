<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import NewsLinkedResource from '@/components/domain/NewsLinkedResource.vue'
import NewsTypeBadge from '@/components/domain/NewsTypeBadge.vue'
import { useColorExtract } from '@/composables/useColorExtract'
import { usePageMeta } from '@/composables/usePageMeta'
import { useThemeStore } from '@/stores/theme'
import type { PublicNewsResponse } from '@/types/api/news'
import { NEWS_TYPE_ACCENT } from '@/utils/constants'
import { renderMarkdown } from '@/utils/markdown'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const themeStore = useThemeStore()

const news = ref<PublicNewsResponse | null>(null)
const loading = ref(true)
const notFound = ref(false)

const slug = computed(() => String(route.params.slug ?? ''))

const renderedBody = computed(() => (news.value ? renderMarkdown(news.value.content) : ''))

const accent = computed(() => (news.value ? NEWS_TYPE_ACCENT[news.value.type] : 'var(--accent)'))

const imageUrlRef = computed(() => news.value?.imageUrl ?? '')
const { dominantColor } = useColorExtract(imageUrlRef)

const detailAccent = computed(() => {
  const color = dominantColor.value
  if (!color) return accent.value
  if (themeStore.resolvedBase === 'dark') {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (match) {
      const r = Math.min(255, Number(match[1]) + 60)
      const g = Math.min(255, Number(match[2]) + 60)
      const b = Math.min(255, Number(match[3]) + 60)
      return `rgb(${r}, ${g}, ${b})`
    }
  }
  return color
})

usePageMeta({
  title: computed(() => (news.value ? `${news.value.title} | AccSaber News` : 'News | AccSaber')),
  description: computed(() => news.value?.description ?? 'AccSaber news article.'),
  image: computed(() => news.value?.imageUrl ?? undefined),
})

async function load(slugVal: string) {
  if (!slugVal) return
  loading.value = true
  notFound.value = false
  try {
    const { getNewsBySlug, getNewsById } = await import('@/api/news')
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugVal)
    news.value = isUuid ? await getNewsById(slugVal) : await getNewsBySlug(slugVal)
  } catch {
    news.value = null
    notFound.value = true
  } finally {
    loading.value = false
  }
}

watch(slug, (s) => load(s), { immediate: true })

function formatDate(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}
</script>

<template>
  <div class="news-detail" :style="{ '--detail-accent': detailAccent }">
    <div v-if="loading" class="news-detail__loading">
      <SkeletonLoader variant="card" style="height: 240px" />
      <SkeletonLoader variant="text" style="margin-top: var(--space-lg); height: 32px" />
      <SkeletonLoader variant="text" style="margin-top: var(--space-md); height: 200px" />
    </div>

    <EmptyState
      v-else-if="notFound || !news"
      message="This news article wasn't found or isn't published."
      action-label="Back to News"
      @action="$router.push('/news')"
    />

    <article v-else class="news-detail__article">
      <div v-if="news.imageUrl" class="news-detail__hero">
        <img :src="news.imageUrl" :alt="news.title" fetchpriority="high" decoding="async" />
      </div>

      <header class="news-detail__header">
        <div class="news-detail__meta">
          <NewsTypeBadge :type="news.type" />
          <span v-if="news.pinned" class="news-detail__pin">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
            </svg>
            Pinned
          </span>
          <span v-if="news.publishedAt" class="news-detail__date">{{ formatDate(news.publishedAt) }}</span>
        </div>

        <h1 class="news-detail__title">{{ news.title }}</h1>
        <p v-if="news.description" class="news-detail__description">{{ news.description }}</p>
        <p v-if="news.authorName" class="news-detail__author">by {{ news.authorName }}</p>
      </header>

      <div class="news-detail__body markdown" v-html="renderedBody" />

      <NewsLinkedResource :news="news" />
    </article>
  </div>
</template>

<style scoped>
.news-detail {
  max-width: 760px;
  margin: 0 auto;
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  --accent: var(--detail-accent);
}

.news-detail__loading {
  display: flex;
  flex-direction: column;
}

.news-detail__article {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.news-detail__hero {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 7;
  border-radius: var(--radius-card);
  overflow: hidden;
  background: var(--bg-elevated);
}

.news-detail__hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.news-detail__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.news-detail__meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.news-detail__pin {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-caption);
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--detail-accent);
}

.news-detail__date {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}

.news-detail__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.news-detail__description {
  font-size: 1.05rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.news-detail__author {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.news-detail__body {
  color: var(--text-primary);
  font-size: 1rem;
  line-height: 1.65;
}

@media (max-width: 767px) {
  .news-detail {
    padding: var(--space-md);
  }

  .news-detail__hero {
    aspect-ratio: 16 / 9;
  }
}
</style>

<style>
.news-detail__body.markdown h1,
.news-detail__body.markdown h2,
.news-detail__body.markdown h3,
.news-detail__body.markdown h4 {
  color: var(--text-primary);
  font-weight: 600;
  margin: var(--space-lg) 0 var(--space-sm);
  line-height: 1.3;
}

.news-detail__body.markdown h1 { font-size: 1.6rem; }
.news-detail__body.markdown h2 { font-size: 1.35rem; }
.news-detail__body.markdown h3 { font-size: 1.15rem; }
.news-detail__body.markdown h4 { font-size: 1rem; }

.news-detail__body.markdown p {
  margin: 0 0 var(--space-md);
}

.news-detail__body.markdown a {
  color: var(--detail-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.news-detail__body.markdown a:hover {
  filter: brightness(1.15);
}

.news-detail__body.markdown ul,
.news-detail__body.markdown ol {
  margin: 0 0 var(--space-md);
  padding-left: var(--space-lg);
}

.news-detail__body.markdown li {
  margin-bottom: var(--space-xs);
}

.news-detail__body.markdown blockquote {
  margin: var(--space-md) 0;
  padding: var(--space-sm) var(--space-md);
  border-left: 1px solid var(--detail-accent);
  background: color-mix(in srgb, var(--detail-accent) 8%, transparent);
  color: var(--text-secondary);
  border-radius: 0 var(--radius-input) var(--radius-input) 0;
}

.news-detail__body.markdown code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
}

.news-detail__body.markdown pre {
  margin: 0 0 var(--space-md);
  padding: var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  overflow-x: auto;
}

.news-detail__body.markdown pre code {
  background: transparent;
  border: none;
  padding: 0;
}

.news-detail__body.markdown img {
  max-width: 100%;
  border-radius: var(--radius-card);
  margin: var(--space-md) 0;
}

.news-detail__body.markdown hr {
  border: none;
  border-top: 1px solid var(--bg-overlay);
  margin: var(--space-lg) 0;
}

.news-detail__body.markdown table {
  width: 100%;
  border-collapse: collapse;
  margin: var(--space-md) 0;
}

.news-detail__body.markdown th,
.news-detail__body.markdown td {
  padding: var(--space-sm);
  border-bottom: 1px solid var(--bg-overlay);
  text-align: left;
}

.news-detail__body.markdown th {
  color: var(--text-secondary);
  font-weight: 600;
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
