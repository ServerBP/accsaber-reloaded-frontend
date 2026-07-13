<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import ImageUploader from '@/components/common/ImageUploader.vue'
import NewsResourceSelector, { type ResourceKind } from '@/components/domain/NewsResourceSelector.vue'
import type { CreateNewsRequest, NewsResponse } from '@/types/api/news'
import type { NewsStatus, NewsType } from '@/types/enums'
import { STANDALONE_NEWS_TYPES } from '@/utils/constants'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  editing: NewsResponse | null
  allowed: ResourceKind[]
  allowedStandalone?: NewsType[]
  loading?: boolean
  uploadImage?: (id: string, file: File) => Promise<NewsResponse>
  deleteImage?: (id: string) => Promise<NewsResponse>
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: CreateNewsRequest]
  imageChanged: [news: NewsResponse]
}>()

const STATUS_OPTIONS: NewsStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED']

const title = ref('')
const slug = ref('')
const description = ref('')
const content = ref('')
const imageUrl = ref('')
const status = ref<NewsStatus>('DRAFT')
const pinned = ref(false)
const resourceType = ref<NewsType>('GENERAL')
const resourceId = ref<string | null>(null)
const formError = ref('')

const isEdit = computed(() => props.editing !== null)
const titleLabel = computed(() => (isEdit.value ? 'Edit News' : 'New News'))
const submitLabel = computed(() => (isEdit.value ? 'Save' : 'Create'))

function deriveResourceFromNews(n: NewsResponse | null): { type: NewsType; id: string | null } {
  if (!n) return { type: 'GENERAL', id: null }
  const id = n.batchId ?? n.campaignId ?? n.milestoneSetId ?? n.curveId ?? null
  return { type: n.type, id }
}

function reset() {
  const n = props.editing
  title.value = n?.title ?? ''
  slug.value = n?.slug ?? ''
  description.value = n?.description ?? ''
  content.value = n?.content ?? ''
  imageUrl.value = n?.imageUrl ?? ''
  status.value = n?.status ?? 'DRAFT'
  pinned.value = n?.pinned ?? false
  const { type, id } = deriveResourceFromNews(n)
  resourceType.value = type
  resourceId.value = id
  formError.value = ''
}

watch(
  () => [props.open, props.editing],
  ([open]) => {
    if (open) reset()
  },
  { immediate: true },
)

function buildPayload(): CreateNewsRequest | null {
  if (!title.value.trim()) {
    formError.value = 'Title is required.'
    return null
  }
  if (!content.value.trim()) {
    formError.value = 'Content is required.'
    return null
  }
  const standalone = STANDALONE_NEWS_TYPES.includes(resourceType.value)
  if (!standalone && !resourceId.value) {
    formError.value = 'Pick a specific resource or choose a standalone type.'
    return null
  }

  const payload: CreateNewsRequest = {
    title: title.value.trim(),
    slug: slug.value.trim() || undefined,
    description: description.value.trim() || undefined,
    content: content.value,
    imageUrl: imageUrl.value.trim() || undefined,
    status: status.value,
    pinned: pinned.value,
    type: resourceType.value,
    batchId: resourceType.value === 'BATCH' ? resourceId.value : null,
    campaignId: resourceType.value === 'CAMPAIGN' ? resourceId.value : null,
    milestoneSetId: resourceType.value === 'MILESTONE_SET' ? resourceId.value : null,
    curveId: resourceType.value === 'CURVE' ? resourceId.value : null,
  }
  return payload
}

function submit() {
  formError.value = ''
  const payload = buildPayload()
  if (!payload) return
  emit('submit', payload)
}

const canUploadImage = computed(() => isEdit.value && !!props.uploadImage)

async function handleImageUpload(file: File) {
  if (!props.editing || !props.uploadImage) return
  const updated = await props.uploadImage(props.editing.id, file)
  imageUrl.value = updated.imageUrl ?? ''
  emit('imageChanged', updated)
}

async function handleImageRemove() {
  if (!props.editing || !props.deleteImage) return
  const updated = await props.deleteImage(props.editing.id)
  imageUrl.value = updated.imageUrl ?? ''
  emit('imageChanged', updated)
}
</script>

<template>
  <BaseModal :open="open" :title="titleLabel" max-width="640px" @close="emit('close')">
    <div class="news-form">
      <BaseInput v-model="title" label="Title" placeholder="Headline" />
      <BaseInput v-model="slug" label="Slug (optional)" placeholder="auto-generated from title if blank" />
      <BaseInput v-model="description" label="Description (optional)" placeholder="One-line summary" />

      <div class="news-form__field">
        <label class="news-form__label">Content (Markdown)</label>
        <textarea v-model="content" class="news-form__textarea" rows="10" placeholder="Body of the article…" />
      </div>

      <BaseInput v-model="imageUrl" label="Image URL (optional)" placeholder="https://…" />

      <ImageUploader
        v-if="canUploadImage"
        label="Cover Image"
        hint="Uploaded to the CDN, stored as WEBP"
        :image-url="imageUrl || null"
        :upload-handler="handleImageUpload"
        :remove-handler="deleteImage ? handleImageRemove : undefined"
      />

      <div class="news-form__row">
        <div class="news-form__field">
          <label class="news-form__label">Status</label>
          <select v-model="status" class="news-form__native-select">
            <option v-for="s in STATUS_OPTIONS" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <label class="news-form__checkbox">
          <input v-model="pinned" type="checkbox" />
          Pinned
        </label>
      </div>

      <NewsResourceSelector
        :allowed="allowed"
        :allowed-standalone="allowedStandalone"
        :resource-type="resourceType"
        :resource-id="resourceId"
        @update:resource-type="resourceType = $event"
        @update:resource-id="resourceId = $event"
      />

      <p v-if="formError" class="news-form__error">{{ formError }}</p>
    </div>

    <template #footer>
      <BaseButton @click="emit('close')">Cancel</BaseButton>
      <BaseButton variant="primary" :loading="loading" @click="submit">{{ submitLabel }}</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.news-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.news-form__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.news-form__label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.news-form__textarea {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-body);
  line-height: 1.5;
  resize: vertical;
  min-height: 180px;
  outline: none;
  transition: border-color 120ms ease-in, box-shadow 120ms ease-in;
}

.news-form__textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
}

.news-form__native-select {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  outline: none;
}

.news-form__native-select:focus {
  border-color: var(--accent);
}

.news-form__row {
  display: flex;
  gap: var(--space-lg);
  align-items: flex-end;
  flex-wrap: wrap;
}

.news-form__checkbox {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--text-body);
  color: var(--text-primary);
  cursor: pointer;
}

.news-form__error {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--error);
}
</style>
