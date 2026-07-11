<script setup lang="ts">
import { getApiErrorMessage } from '@/api/client'
import { updateMyProfile } from '@/api/users'
import BaseButton from '@/components/common/BaseButton.vue'
import RichTextEditor from '@/components/common/RichTextEditor.vue'
import { computed, onBeforeUnmount, ref } from 'vue'

const BIO_MAX_STANDARD = 4000

const props = withDefaults(
  defineProps<{
    initialBio: string
    maxChars?: number
    canUseEffects?: boolean
  }>(),
  { maxChars: BIO_MAX_STANDARD, canUseEffects: true },
)

const BIO_MAX = computed(() => props.maxChars)
const isPerkBoosted = computed(() => props.maxChars > BIO_MAX_STANDARD)

const emit = defineEmits<{
  saved: [bio: string]
  cancel: []
}>()

const bioHtml = ref(props.initialBio)
const submitting = ref(false)
const errorMessage = ref<string | null>(null)
const savedAt = ref(0)
let savedClearTimer: ReturnType<typeof setTimeout> | null = null

const charCount = computed(() => bioHtml.value.length)
const overLimit = computed(() => charCount.value > BIO_MAX.value)

const hintText = computed(() =>
  props.canUseEffects
    ? 'Server strips disallowed tags on save.'
    : 'Colors, fonts & effects are a supporter perk. Server strips disallowed tags on save.',
)

onBeforeUnmount(() => {
  if (savedClearTimer) clearTimeout(savedClearTimer)
})

function flashSaved() {
  savedAt.value = Date.now()
  if (savedClearTimer) clearTimeout(savedClearTimer)
  savedClearTimer = setTimeout(() => {
    savedAt.value = 0
  }, 2500)
}

async function onSave() {
  if (overLimit.value) return
  if (bioHtml.value === props.initialBio) {
    emit('saved', bioHtml.value)
    flashSaved()
    return
  }
  submitting.value = true
  errorMessage.value = null
  try {
    await updateMyProfile({ bio: bioHtml.value })
    emit('saved', bioHtml.value)
    flashSaved()
  } catch (err) {
    errorMessage.value = getApiErrorMessage(err, 'Could not save your bio.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="bio-editor">
    <RichTextEditor v-model="bioHtml" aria-label="Bio editor" :allow-rich-effects="canUseEffects" autofocus />

    <div class="bio-editor__footer">
      <div class="bio-editor__footer-info">
        <span v-if="overLimit" class="bio-editor__error">Bio is over the {{ BIO_MAX.toLocaleString() }} character limit.</span>
        <span v-else-if="errorMessage" class="bio-editor__error">{{ errorMessage }}</span>
        <span v-else-if="savedAt" class="bio-editor__saved">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Saved
        </span>
        <span v-else class="bio-editor__hint">{{ hintText }}</span>
        <span class="bio-editor__counter-row">
          <span class="bio-editor__counter" :class="{ 'bio-editor__counter--over': overLimit }">
            {{ charCount.toLocaleString() }} / {{ BIO_MAX.toLocaleString() }}
          </span>
          <span v-if="isPerkBoosted" class="bio-editor__perk" title="Supporters get a higher character limit">
            Supporter perk
          </span>
        </span>
      </div>
      <div class="bio-editor__footer-actions">
        <BaseButton type="button" size="sm" @click="emit('cancel')">Cancel</BaseButton>
        <BaseButton type="button" size="sm" variant="primary" :loading="submitting" :disabled="overLimit"
          @click="onSave">Save bio</BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bio-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.bio-editor__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
}

.bio-editor__footer-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: var(--text-caption);
}

.bio-editor__footer-actions {
  display: flex;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.bio-editor__hint {
  color: var(--text-tertiary);
}

.bio-editor__counter-row {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-sm);
}

.bio-editor__counter {
  font-family: var(--font-mono);
  color: var(--text-tertiary);
}

.bio-editor__counter--over {
  color: var(--error);
}

.bio-editor__perk {
  font-family: var(--font-sans);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.bio-editor__error {
  color: var(--error);
}

.bio-editor__saved {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--success);
}

@media (max-width: 599px) {
  .bio-editor__footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
