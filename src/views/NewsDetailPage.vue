<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import NewsArticle from '@/components/domain/NewsArticle.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import type { PublicNewsResponse } from '@/types/api/news'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const news = ref<PublicNewsResponse | null>(null)
const loading = ref(true)
const notFound = ref(false)

const slug = computed(() => String(route.params.slug ?? ''))

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
</script>

<template>
  <div class="news-detail">
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

    <NewsArticle v-else :news="news" />
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
}

.news-detail__loading {
  display: flex;
  flex-direction: column;
}

@media (max-width: 767px) {
  .news-detail {
    padding: var(--space-md);
  }
}
</style>
