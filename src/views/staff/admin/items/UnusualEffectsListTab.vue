<script setup lang="ts">
import {
  createAdminUnusualEffect,
  setAdminUnusualEffectActive,
  getAdminUnusualEffects,
  updateAdminUnusualEffect,
} from '@/api/admin/unusual-effects'
import { parseApiError } from '@/api/client'
import AdminTable from '@/components/admin/AdminTable.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import ModifierCompositions from '@/components/domain/ModifierCompositions.vue'
import type { ModifierEffectSpec, UnusualEffectResponse } from '@/types/api/items'
import { computed, onMounted, ref } from 'vue'

const STARTER_SPEC = `{
  "contractVersion": 1,
  "compositions": []
}`

const effects = ref<UnusualEffectResponse[]>([])
const loading = ref(false)

const modalOpen = ref(false)
const editing = ref<UnusualEffectResponse | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

const form = ref({ key: '', name: '', description: '', specText: STARTER_SPEC })

const parsedSpec = computed<ModifierEffectSpec | null>(() => {
  try {
    const value = JSON.parse(form.value.specText)
    if (!value || typeof value !== 'object' || !Array.isArray(value.compositions)) return null
    return value as ModifierEffectSpec
  } catch {
    return null
  }
})

function compositionSummary(spec: ModifierEffectSpec | null): string {
  const types = spec?.compositions?.map((c) => c.type) ?? []
  return types.length ? types.join(', ') : 'None'
}

async function fetchEffects() {
  loading.value = true
  try {
    effects.value = await getAdminUnusualEffects(true)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.value = { key: '', name: '', description: '', specText: STARTER_SPEC }
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

function openEdit(effect: UnusualEffectResponse) {
  editing.value = effect
  form.value = {
    key: effect.key,
    name: effect.name,
    description: effect.description ?? '',
    specText: JSON.stringify(effect.effectSpec ?? { contractVersion: 1, compositions: [] }, null, 2),
  }
  formError.value = null
  fieldErrors.value = {}
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
}

function validate(): ModifierEffectSpec | null {
  fieldErrors.value = {}
  formError.value = null
  if (!editing.value && !form.value.key.trim()) {
    fieldErrors.value.key = 'Key is required.'
  }
  if (!form.value.name.trim()) {
    fieldErrors.value.name = 'Name is required.'
  }
  const spec = parsedSpec.value
  if (!spec) {
    fieldErrors.value.specText = 'Effect spec must be valid JSON with a compositions array.'
  }
  if (Object.keys(fieldErrors.value).length) return null
  return spec
}

async function save() {
  const spec = validate()
  if (!spec) return
  const description = form.value.description.trim() ? form.value.description.trim() : null
  saving.value = true
  try {
    if (editing.value) {
      const updated = await updateAdminUnusualEffect(editing.value.id, {
        name: form.value.name.trim(),
        description: description ?? '',
        effectSpec: spec,
      })
      effects.value = effects.value.map((e) => (e.id === updated.id ? updated : e))
    } else {
      const created = await createAdminUnusualEffect({
        key: form.value.key.trim(),
        name: form.value.name.trim(),
        description,
        effectSpec: spec,
      })
      effects.value = [...effects.value, created]
    }
    closeModal()
  } catch (e) {
    const parsed = parseApiError(e, 'Failed to save unusual effect')
    for (const fe of parsed.fieldErrors) fieldErrors.value[fe.field] = fe.message
    formError.value = parsed.message
  } finally {
    saving.value = false
  }
}

const togglingId = ref<string | null>(null)

async function toggleActive(effect: UnusualEffectResponse) {
  togglingId.value = effect.id
  try {
    const updated = await setAdminUnusualEffectActive(effect.id, !effect.active)
    effects.value = effects.value.map((e) => (e.id === updated.id ? updated : e))
  } finally {
    togglingId.value = null
  }
}

onMounted(fetchEffects)
</script>

<template>
  <div class="ue-tab">
    <div class="ue-tab__bar">
      <p class="ue-tab__hint">
        Unusual effects are the pool an Unusual roll draws from. Attach effects to a crate in its
        editor to include them in that crate's equal-chance roll.
      </p>
      <BaseButton size="sm" variant="primary" @click="openCreate">New effect</BaseButton>
    </div>

    <AdminTable :items="effects" :loading="loading" empty-message="No unusual effects">
      <template #head>
        <th>Name</th>
        <th>Key</th>
        <th>Compositions</th>
        <th>Status</th>
        <th></th>
      </template>

      <template #default="{ item }: { item: UnusualEffectResponse }">
        <td>
          <span class="ue-tab__name">{{ item.name }}</span>
          <span v-if="item.description" class="ue-tab__desc">{{ item.description }}</span>
        </td>
        <td class="mono">{{ item.key }}</td>
        <td class="ue-tab__comp">{{ compositionSummary(item.effectSpec) }}</td>
        <td>
          <span class="ue-tab__status" :class="{ 'ue-tab__status--off': !item.active }">
            {{ item.active ? 'Active' : 'Inactive' }}
          </span>
        </td>
        <td class="right ue-tab__actions">
          <BaseButton size="sm" @click="openEdit(item)">Edit</BaseButton>
          <BaseButton
            size="sm"
            :variant="item.active ? 'destructive' : 'default'"
            :loading="togglingId === item.id"
            @click="toggleActive(item)"
          >
            {{ item.active ? 'Deactivate' : 'Reactivate' }}
          </BaseButton>
        </td>
      </template>
    </AdminTable>

    <BaseModal
      :open="modalOpen"
      :title="editing ? `Edit ${editing.name}` : 'New unusual effect'"
      max-width="680px"
      @close="closeModal"
    >
      <div class="ue-tab__form">
        <BaseInput
          v-if="!editing"
          v-model="form.key"
          label="Key"
          :error="fieldErrors.key"
          placeholder="e.g. fiery"
        />
        <div v-else class="ue-tab__readonly">
          <span class="ue-tab__readonly-label">Key</span>
          <span class="ue-tab__readonly-value mono">{{ form.key }}</span>
        </div>

        <BaseInput v-model="form.name" label="Name" :error="fieldErrors.name" />

        <div class="ue-tab__field">
          <label class="ue-tab__label">Description</label>
          <textarea v-model="form.description" class="ue-tab__textarea" rows="2" placeholder="Optional" />
        </div>

        <div class="ue-tab__field">
          <label class="ue-tab__label">Effect spec (JSON)</label>
          <div class="ue-tab__spec">
            <textarea
              v-model="form.specText"
              class="ue-tab__textarea ue-tab__textarea--code"
              :class="{ 'ue-tab__textarea--error': fieldErrors.specText }"
              rows="12"
              spellcheck="false"
            />
            <div class="ue-tab__preview" aria-hidden="true">
              <span class="ue-tab__preview-label">Preview</span>
              <div class="ue-tab__preview-tile">
                <ModifierCompositions v-if="parsedSpec" :spec="parsedSpec" />
              </div>
            </div>
          </div>
          <p v-if="fieldErrors.specText" class="ue-tab__field-error">{{ fieldErrors.specText }}</p>
        </div>

        <p v-if="formError" class="ue-tab__error">{{ formError }}</p>
      </div>

      <template #footer>
        <BaseButton size="sm" @click="closeModal">Cancel</BaseButton>
        <BaseButton variant="primary" size="sm" :loading="saving" @click="save">Save</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.ue-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.ue-tab__bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
}

.ue-tab__hint {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  line-height: 1.4;
}

.ue-tab__name {
  display: block;
  font-weight: 500;
  color: var(--text-primary);
}

.ue-tab__desc {
  display: block;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.ue-tab__comp {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.ue-tab__status {
  font-size: var(--text-caption);
  color: var(--success);
}

.ue-tab__status--off {
  color: var(--text-tertiary);
}

.ue-tab__actions {
  display: flex;
  gap: var(--space-xs);
  justify-content: flex-end;
}

.ue-tab__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.ue-tab__readonly {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ue-tab__readonly-label,
.ue-tab__label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.ue-tab__readonly-value {
  color: var(--text-primary);
}

.ue-tab__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.ue-tab__textarea {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  outline: none;
  resize: vertical;
}

.ue-tab__textarea:focus {
  border-color: var(--accent);
}

.ue-tab__textarea--code {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  line-height: 1.5;
}

.ue-tab__textarea--error {
  border-color: var(--error);
}

.ue-tab__spec {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-md);
  align-items: start;
}

.ue-tab__preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.ue-tab__preview-label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ue-tab__preview-tile {
  position: relative;
  width: 96px;
  height: 96px;
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.ue-tab__field-error {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--error);
}

.ue-tab__error {
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--error);
  background: color-mix(in srgb, var(--error) 12%, transparent);
  color: var(--error);
  border-radius: var(--radius-card);
  font-size: var(--text-caption);
}

@media (max-width: 640px) {
  .ue-tab__spec {
    grid-template-columns: 1fr;
  }
}
</style>
