<script setup lang="ts">
import NewsLinkedResource from '@/components/domain/NewsLinkedResource.vue'
import NewsTypeBadge from '@/components/domain/NewsTypeBadge.vue'
import { useColorExtract } from '@/composables/useColorExtract'
import { useThemeStore } from '@/stores/theme'
import type { PublicNewsResponse } from '@/types/api/news'
import { NEWS_TYPE_ACCENT } from '@/utils/constants'
import { renderMarkdown } from '@/utils/markdown'
import { computed } from 'vue'

const props = defineProps<{
  news: PublicNewsResponse
}>()

const themeStore = useThemeStore()

const renderedBody = computed(() => renderMarkdown(props.news.content))
const accent = computed(() => NEWS_TYPE_ACCENT[props.news.type])

const imageUrlRef = computed(() => props.news.imageUrl ?? '')
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

function formatDate(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}
</script>

<template>
  <article class="news-article" :style="{ '--detail-accent': detailAccent }">
    <div v-if="news.imageUrl" class="news-article__hero">
      <img :src="news.imageUrl" :alt="news.title" fetchpriority="high" decoding="async" />
    </div>

    <header class="news-article__header">
      <div class="news-article__meta">
        <NewsTypeBadge :type="news.type" />
        <span v-if="news.pinned" class="news-article__pin">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
          </svg>
          Pinned
        </span>
        <span v-if="news.publishedAt" class="news-article__date">{{ formatDate(news.publishedAt) }}</span>
      </div>

      <h1 class="news-article__title">{{ news.title }}</h1>
      <p v-if="news.description" class="news-article__description">{{ news.description }}</p>
      <p v-if="news.authorName" class="news-article__author">by {{ news.authorName }}</p>
    </header>

    <div class="news-article__body markdown" v-html="renderedBody" />

    <NewsLinkedResource :news="news" />
  </article>
</template>

<style scoped>
.news-article {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  --accent: var(--detail-accent);
}

.news-article__hero {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 7;
  border-radius: var(--radius-card);
  overflow: hidden;
  background: var(--bg-elevated);
}

.news-article__hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.news-article__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.news-article__meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.news-article__pin {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-caption);
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--detail-accent);
}

.news-article__date {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}

.news-article__title {
  font-size: var(--text-page-title);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.news-article__description {
  font-size: 1.05rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.news-article__author {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.news-article__body {
  color: var(--text-primary);
  font-size: 1rem;
  line-height: 1.65;
}
</style>

<style>
.news-article__body.markdown h1,
.news-article__body.markdown h2,
.news-article__body.markdown h3,
.news-article__body.markdown h4 {
  color: var(--text-primary);
  font-weight: 600;
  margin: var(--space-lg) 0 var(--space-sm);
  line-height: 1.3;
}

.news-article__body.markdown h1 { font-size: 1.6rem; }
.news-article__body.markdown h2 { font-size: 1.35rem; }
.news-article__body.markdown h3 { font-size: 1.15rem; }
.news-article__body.markdown h4 { font-size: 1rem; }

.news-article__body.markdown p {
  margin: 0 0 var(--space-md);
}

.news-article__body.markdown a {
  color: var(--detail-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.news-article__body.markdown a:hover {
  filter: brightness(1.15);
}

.news-article__body.markdown ul,
.news-article__body.markdown ol {
  margin: 0 0 var(--space-md);
  padding-left: var(--space-lg);
}

.news-article__body.markdown li {
  margin-bottom: var(--space-xs);
}

.news-article__body.markdown blockquote {
  margin: var(--space-md) 0;
  padding: var(--space-sm) var(--space-md);
  border-left: 1px solid var(--detail-accent);
  background: color-mix(in srgb, var(--detail-accent) 8%, transparent);
  color: var(--text-secondary);
  border-radius: 0 var(--radius-input) var(--radius-input) 0;
}

.news-article__body.markdown code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
}

.news-article__body.markdown pre {
  margin: 0 0 var(--space-md);
  padding: var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  overflow-x: auto;
}

.news-article__body.markdown pre code {
  background: transparent;
  border: none;
  padding: 0;
}

.news-article__body.markdown img {
  max-width: 100%;
  border-radius: var(--radius-card);
  margin: var(--space-md) 0;
}

.news-article__body.markdown hr {
  border: none;
  border-top: 1px solid var(--bg-overlay);
  margin: var(--space-lg) 0;
}

.news-article__body.markdown table {
  width: 100%;
  border-collapse: collapse;
  margin: var(--space-md) 0;
}

.news-article__body.markdown th,
.news-article__body.markdown td {
  padding: var(--space-sm);
  border-bottom: 1px solid var(--bg-overlay);
  text-align: left;
}

.news-article__body.markdown th {
  color: var(--text-secondary);
  font-weight: 600;
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
