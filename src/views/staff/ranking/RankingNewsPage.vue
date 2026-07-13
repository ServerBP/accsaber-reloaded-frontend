<script setup lang="ts">
import NewsManagementView from '@/components/domain/NewsManagementView.vue'
import type { ResourceKind } from '@/components/domain/NewsResourceSelector.vue'
import { usePageMeta } from '@/composables/usePageMeta'
import type {
  CreateNewsRequest,
  StaffNewsListParams,
  UpdateNewsRequest,
} from '@/types/api/news'

const ALLOWED: ResourceKind[] = ['BATCH']

usePageMeta({
  title: 'My News | AccSaber Ranking',
  description: 'Manage your batch news posts.',
})

async function fetchPage(params: StaffNewsListParams) {
  const { listMyNews } = await import('@/api/ranking/news')
  return listMyNews(params)
}

async function onCreate(req: CreateNewsRequest) {
  const { createRankingNews } = await import('@/api/ranking/news')
  return createRankingNews(req)
}

async function onUpdate(id: string, req: UpdateNewsRequest) {
  const { updateRankingNews } = await import('@/api/ranking/news')
  return updateRankingNews(id, req)
}

async function onUploadImage(id: string, file: File) {
  const { uploadRankingNewsImage } = await import('@/api/ranking/news')
  return uploadRankingNewsImage(id, file)
}

async function onDeleteImage(id: string) {
  const { deleteRankingNewsImage } = await import('@/api/ranking/news')
  return deleteRankingNewsImage(id)
}
</script>

<template>
  <div class="ranking-news">
    <NewsManagementView
      title="My News"
      :allowed="ALLOWED"
      :fetch-page="fetchPage"
      :on-create="onCreate"
      :on-update="onUpdate"
      :on-delete="null"
      :on-upload-image="onUploadImage"
      :on-delete-image="onDeleteImage"
    />
  </div>
</template>

<style scoped>
.ranking-news {
  padding: var(--space-xl);
}

@media (max-width: 767px) {
  .ranking-news {
    padding: var(--space-md);
  }
}
</style>
