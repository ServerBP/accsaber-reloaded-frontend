<script setup lang="ts">
import AdminTable from '@/components/admin/AdminTable.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import PaginationControls from '@/components/common/PaginationControls.vue'
import NewsFormModal from '@/components/domain/NewsFormModal.vue'
import NewsTypeBadge from '@/components/domain/NewsTypeBadge.vue'
import type { ResourceKind } from '@/components/domain/NewsResourceSelector.vue'
import type {
  CreateNewsRequest,
  NewsResponse,
  StaffNewsListParams,
  UpdateNewsRequest,
} from '@/types/api/news'
import type { Page } from '@/types/pagination'
import type { NewsStatus, NewsType } from '@/types/enums'
import { NEWS_TYPE_LABELS, NEWS_TYPE_ORDER } from '@/utils/constants'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  title: string
  meta?: string
  allowed: ResourceKind[]
  allowedStandalone?: NewsType[]
  fetchPage: (params: StaffNewsListParams) => Promise<Page<NewsResponse>>
  onCreate: (req: CreateNewsRequest) => Promise<NewsResponse>
  onUpdate: (id: string, req: UpdateNewsRequest) => Promise<NewsResponse>
  onDelete?: ((id: string, hard: boolean) => Promise<void>) | null
  onUploadImage?: (id: string, file: File) => Promise<NewsResponse>
  onDeleteImage?: (id: string) => Promise<NewsResponse>
}>()

const items = ref<NewsResponse[]>([])
const loading = ref(false)
const totalPages = ref(0)
const totalElements = ref(0)
const page = ref(1)
const size = 15

const statusFilter = ref<NewsStatus | ''>('')
const typeFilter = ref<NewsType | ''>('')

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const typeOptions = computed(() => {
  const standalone = props.allowedStandalone ?? ['GENERAL']
  const allowedSet = new Set<NewsType>([...standalone, ...props.allowed])
  return [
    { value: '', label: 'All types' },
    ...NEWS_TYPE_ORDER
      .filter((t) => allowedSet.has(t))
      .map((t) => ({ value: t, label: NEWS_TYPE_LABELS[t] })),
  ]
})

const showModal = ref(false)
const editing = ref<NewsResponse | null>(null)
const submitting = ref(false)
const errorMessage = ref('')
const actionLoading = ref<Record<string, boolean>>({})

async function fetchList() {
  loading.value = true
  errorMessage.value = ''
  try {
    const params: StaffNewsListParams = {
      page: page.value - 1,
      size,
      sort: 'updatedAt,desc',
    }
    if (statusFilter.value) params.status = statusFilter.value
    if (typeFilter.value) params.type = typeFilter.value as NewsType
    const res = await props.fetchPage(params)
    items.value = res.content
    totalPages.value = res.totalPages
    totalElements.value = res.totalElements
  } catch {
    errorMessage.value = 'Failed to load news.'
  } finally {
    loading.value = false
  }
}

watch([statusFilter, typeFilter], () => {
  page.value = 1
  fetchList()
}, { immediate: true })

watch(page, () => {
  fetchList()
})

function openCreate() {
  editing.value = null
  showModal.value = true
}

function openEdit(news: NewsResponse) {
  editing.value = news
  showModal.value = true
}

async function handleSubmit(payload: CreateNewsRequest) {
  submitting.value = true
  try {
    if (editing.value) {
      await props.onUpdate(editing.value.id, payload as UpdateNewsRequest)
    } else {
      await props.onCreate(payload)
    }
    showModal.value = false
    fetchList()
  } catch {
    errorMessage.value = 'Failed to save the news article.'
  } finally {
    submitting.value = false
  }
}

async function handleDelete(news: NewsResponse, hard: boolean) {
  if (!props.onDelete) return
  const message = hard
    ? `Permanently delete "${news.title}"? This cannot be undone.`
    : `Delete "${news.title}"? It will be hidden from all views.`
  if (!confirm(message)) return
  actionLoading.value[news.id] = true
  try {
    await props.onDelete(news.id, hard)
    items.value = items.value.filter((n) => n.id !== news.id)
  } catch {
    errorMessage.value = 'Failed to delete the news article.'
  } finally {
    delete actionLoading.value[news.id]
  }
}

function onImageChanged(updated: NewsResponse) {
  const idx = items.value.findIndex((n) => n.id === updated.id)
  if (idx !== -1) items.value[idx] = updated
}

function formatDate(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const STATUS_STYLE: Record<NewsStatus, string> = {
  DRAFT: 'var(--text-tertiary)',
  PUBLISHED: 'var(--success)',
  ARCHIVED: 'var(--warning)',
}
</script>

<template>
  <div class="news-mgmt">
    <div class="news-mgmt__header">
      <div>
        <h2 class="news-mgmt__title">{{ title }}</h2>
        <p class="news-mgmt__meta">{{ meta ?? `${totalElements} articles` }}</p>
      </div>
      <div class="news-mgmt__actions">
        <BaseSelect v-model="typeFilter" :options="typeOptions" style="width: 160px" />
        <BaseSelect v-model="statusFilter" :options="STATUS_OPTIONS" style="width: 160px" />
        <BaseButton variant="primary" @click="openCreate">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Article
        </BaseButton>
      </div>
    </div>

    <p v-if="errorMessage" class="news-mgmt__error">{{ errorMessage }}</p>

    <AdminTable :items="items" :loading="loading" :loading-rows="size" empty-message="No articles found">
      <template #head>
        <th>Title</th>
        <th style="width: 120px">Type</th>
        <th style="width: 110px">Status</th>
        <th style="width: 60px" class="right">Pinned</th>
        <th>Author</th>
        <th class="mono" style="width: 130px">Published</th>
        <th class="mono" style="width: 130px">Updated</th>
        <th class="right" style="width: 200px" />
      </template>
      <template #default="{ item }">
        <td>
          <div class="news-mgmt__title-cell">
            <span class="news-mgmt__name">{{ item.title }}</span>
            <span class="news-mgmt__slug">/{{ item.slug }}</span>
          </div>
        </td>
        <td>
          <NewsTypeBadge :type="item.type" size="sm" />
        </td>
        <td>
          <span class="news-mgmt__status" :style="{ color: STATUS_STYLE[item.status], borderColor: STATUS_STYLE[item.status] }">
            {{ item.status }}
          </span>
        </td>
        <td class="right">
          <span v-if="item.pinned" class="news-mgmt__pinned" aria-label="Pinned">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
            </svg>
          </span>
        </td>
        <td class="muted">{{ item.staffUsername ?? '-' }}</td>
        <td class="mono muted">{{ formatDate(item.publishedAt) }}</td>
        <td class="mono muted">{{ formatDate(item.updatedAt) }}</td>
        <td class="right">
          <div class="news-mgmt__row-actions">
            <BaseButton size="sm" @click="openEdit(item)">Edit</BaseButton>
            <BaseButton
              v-if="onDelete"
              size="sm"
              variant="destructive"
              :loading="actionLoading[item.id]"
              @click="handleDelete(item, false)"
            >
              Delete
            </BaseButton>
          </div>
        </td>
      </template>
    </AdminTable>

    <PaginationControls
      v-if="totalPages > 1"
      :page="page"
      :total-pages="totalPages"
      @update:page="(p: number) => { page = p }"
    />

    <NewsFormModal
      :open="showModal"
      :editing="editing"
      :allowed="allowed"
      :allowed-standalone="allowedStandalone"
      :loading="submitting"
      :upload-image="onUploadImage"
      :delete-image="onDeleteImage"
      @close="showModal = false"
      @submit="handleSubmit"
      @image-changed="onImageChanged"
    />
  </div>
</template>

<style scoped>
.news-mgmt {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.news-mgmt__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-lg);
  flex-wrap: wrap;
}

.news-mgmt__title {
  font-size: var(--text-section-heading);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.news-mgmt__meta {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  margin: 2px 0 0;
}

.news-mgmt__actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.news-mgmt__error {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--error);
}

.news-mgmt__title-cell {
  display: flex;
  flex-direction: column;
}

.news-mgmt__name {
  color: var(--text-primary);
  font-weight: 500;
}

.news-mgmt__slug {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}

.news-mgmt__status {
  font-size: var(--text-caption);
  font-family: var(--font-mono);
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid;
  background: transparent;
}

.news-mgmt__pinned {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
}

.news-mgmt__row-actions {
  display: inline-flex;
  gap: var(--space-xs);
  justify-content: flex-end;
}
</style>
