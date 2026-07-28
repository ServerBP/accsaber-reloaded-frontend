<script setup lang="ts">
import AdminTable from '@/components/admin/AdminTable.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import {
  createItemType,
  setItemTypeActive,
  getAdminItemTypes,
  updateItemType,
} from '@/api/admin/items'
import { useItemTypeStore } from '@/stores/itemTypes'
import type {
  CreateItemTypeRequest,
  ItemTypeResponse,
  UpdateItemTypeRequest,
} from '@/types/api/items'
import { computed, onMounted, ref } from 'vue'

const itemTypeStore = useItemTypeStore()

const types = ref<ItemTypeResponse[]>([])
const loading = ref(false)
const includeInactive = ref(true)

const editing = ref<ItemTypeResponse | null>(null)
const modalOpen = ref(false)
const submitting = ref(false)
const schemaText = ref('')
const schemaError = ref<string | null>(null)
const form = ref<CreateItemTypeRequest>({
  parentTypeId: undefined,
  key: '',
  name: '',
  description: '',
  valueSchema: undefined,
})

const parentOptions = computed(() => [
  { value: '', label: 'No parent' },
  ...types.value.filter((t) => !t.parentTypeId).map((t) => ({ value: t.id, label: `${t.name} (${t.key})` })),
])

const actionBusy = ref<Record<string, boolean>>({})

async function fetchTypes() {
  loading.value = true
  try {
    types.value = await getAdminItemTypes({ includeInactive: includeInactive.value || undefined })
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.value = { parentTypeId: undefined, key: '', name: '', description: '', valueSchema: undefined }
  schemaText.value = ''
  schemaError.value = null
  modalOpen.value = true
}

function openEdit(type: ItemTypeResponse) {
  editing.value = type
  form.value = {
    parentTypeId: type.parentTypeId ?? undefined,
    key: type.key,
    name: type.name,
    description: type.description ?? '',
    valueSchema: type.valueSchema ?? undefined,
  }
  schemaText.value = type.valueSchema ? JSON.stringify(type.valueSchema, null, 2) : ''
  schemaError.value = null
  modalOpen.value = true
}

function parseSchema(): Record<string, unknown> | undefined | false {
  const text = schemaText.value.trim()
  if (!text) return undefined
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      schemaError.value = 'valueSchema must be a JSON object'
      return false
    }
    schemaError.value = null
    return parsed as Record<string, unknown>
  } catch (e) {
    schemaError.value = (e as Error).message
    return false
  }
}

async function submit() {
  const parsed = parseSchema()
  if (parsed === false) return
  submitting.value = true
  try {
    if (editing.value) {
      const req: UpdateItemTypeRequest = {
        name: form.value.name,
        description: form.value.description || undefined,
        valueSchema: parsed,
      }
      const updated = await updateItemType(editing.value.id, req)
      const idx = types.value.findIndex((t) => t.id === updated.id)
      if (idx >= 0) types.value[idx] = updated
    } else {
      const req: CreateItemTypeRequest = {
        ...form.value,
        valueSchema: parsed,
        description: form.value.description || undefined,
        parentTypeId: form.value.parentTypeId || undefined,
      }
      const created = await createItemType(req)
      types.value.unshift(created)
    }
    await itemTypeStore.fetchItemTypes(true)
    modalOpen.value = false
  } finally {
    submitting.value = false
  }
}

async function withBusy(id: string, fn: () => Promise<void>) {
  actionBusy.value[id] = true
  try {
    await fn()
  } finally {
    delete actionBusy.value[id]
  }
}

async function setActive(type: ItemTypeResponse, active: boolean) {
  await withBusy(type.id, async () => {
    const updated = await setItemTypeActive(type.id, active)
    const idx = types.value.findIndex((t) => t.id === updated.id)
    if (idx >= 0) types.value[idx] = updated
    await itemTypeStore.fetchItemTypes(true)
  })
}

async function handleDelete(type: ItemTypeResponse) {
  if (!confirm(`Delete type "${type.name}"? This deactivates the type.`)) return
  await setActive(type, false)
}

function handleReactivate(type: ItemTypeResponse) {
  return setActive(type, true)
}

onMounted(fetchTypes)
</script>

<template>
  <div class="types-mgmt">
    <header class="types-mgmt__bar">
      <label class="types-mgmt__check">
        <input v-model="includeInactive" type="checkbox" @change="fetchTypes" /> Include inactive
      </label>
      <BaseButton variant="primary" size="sm" @click="openCreate">New type</BaseButton>
    </header>

    <AdminTable :items="types" :loading="loading" empty-message="No item types">
      <template #head>
        <th>Key</th>
        <th>Name</th>
        <th>Parent</th>
        <th>Status</th>
        <th class="right">Actions</th>
      </template>

      <template #default="{ item }: { item: ItemTypeResponse }">
        <td class="mono">{{ item.key }}</td>
        <td>{{ item.name }}</td>
        <td class="muted">
          {{ item.parentTypeId ? (types.find((t) => t.id === item.parentTypeId)?.key ?? '?') : '-' }}
        </td>
        <td>{{ item.active ? 'Active' : 'Inactive' }}</td>
        <td class="right">
          <div class="types-mgmt__actions">
            <BaseButton size="sm" :disabled="actionBusy[item.id]" @click="openEdit(item)">Edit</BaseButton>
            <BaseButton
              v-if="item.active"
              size="sm"
              variant="destructive"
              :loading="actionBusy[item.id]"
              @click="handleDelete(item)"
            >Delete</BaseButton>
            <BaseButton
              v-else
              size="sm"
              variant="primary"
              :loading="actionBusy[item.id]"
              @click="handleReactivate(item)"
            >Reactivate</BaseButton>
          </div>
        </td>
      </template>
    </AdminTable>

    <BaseModal :open="modalOpen" :title="editing ? 'Edit type' : 'New item type'" max-width="640px" @close="modalOpen = false">
      <div class="types-mgmt__form">
        <BaseSelect
          :model-value="form.parentTypeId ?? ''"
          :options="parentOptions"
          label="Parent type"
          @update:model-value="(v: string) => form.parentTypeId = v || undefined"
        />
        <BaseInput v-model="form.key" label="Key" :disabled="!!editing" />
        <BaseInput v-model="form.name" label="Name" />
        <BaseInput v-model="form.description" label="Description" />

        <div class="types-mgmt__schema">
          <label class="types-mgmt__schema-label">Value schema (JSON)</label>
          <textarea
            v-model="schemaText"
            class="types-mgmt__schema-input"
            rows="8"
            spellcheck="false"
            placeholder="{}"
          />
          <div v-if="schemaError" class="types-mgmt__schema-error">{{ schemaError }}</div>
        </div>
      </div>

      <template #footer>
        <BaseButton size="sm" @click="modalOpen = false">Cancel</BaseButton>
        <BaseButton variant="primary" size="sm" :loading="submitting" @click="submit">
          {{ editing ? 'Save' : 'Create' }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.types-mgmt {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.types-mgmt__bar {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.types-mgmt__check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  cursor: pointer;
}

.types-mgmt__actions {
  display: inline-flex;
  gap: var(--space-xs);
  justify-content: flex-end;
}

.types-mgmt__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.types-mgmt__schema {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.types-mgmt__schema-label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.types-mgmt__schema-input {
  width: 100%;
  padding: var(--space-sm);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  resize: vertical;
  outline: none;
}

.types-mgmt__schema-input:focus {
  border-color: var(--accent);
}

.types-mgmt__schema-error {
  font-size: var(--text-caption);
  color: var(--error);
}
</style>
