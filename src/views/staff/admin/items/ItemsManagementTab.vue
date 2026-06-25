<script setup lang="ts">
import AdminTable from '@/components/admin/AdminTable.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import ImageUploader from '@/components/common/ImageUploader.vue'
import SchemaValueForm from './value-form/SchemaValueForm.vue'
import {
  createItem,
  deleteItem,
  deleteItemIcon,
  deprecateItem,
  getAdminItems,
  reactivateItem,
  updateItem,
  uploadItemIcon,
} from '@/api/admin/items'
import { parseApiError } from '@/api/client'
import { useItemTypeStore } from '@/stores/itemTypes'
import type {
  CreateItemRequest,
  ItemRarity,
  ItemResponse,
  UpdateItemRequest,
} from '@/types/api/items'
import { parseNullableNumber } from '@/utils/formatters'
import { RARITY_ORDER } from '@/utils/items'
import { cleanValue, type JsonSchema } from './value-form/schemaUtils'
import { computed, onMounted, ref, watch } from 'vue'

const itemTypeStore = useItemTypeStore()

const items = ref<ItemResponse[]>([])
const loading = ref(false)
const includeInactive = ref(false)
const typeFilter = ref<string>('')

const editing = ref<ItemResponse | null>(null)
const modalOpen = ref(false)
const submitting = ref(false)
const activeToggling = ref(false)

const formError = ref<string | null>(null)
const nameError = ref<string | null>(null)
const valueError = ref<string | null>(null)

interface ItemForm {
  typeId: string
  name: string
  description: string
  rarity: ItemRarity
  tradeable: boolean
  visible: boolean
  stackable: boolean
  welcomeGrant: boolean
  missionPoolable: boolean
  active: boolean
  worth: number | null
  requirement: string | null
  unlockLevel: number | null
}

function blankForm(typeId = ''): ItemForm {
  return {
    typeId,
    name: '',
    description: '',
    rarity: 'common',
    tradeable: false,
    visible: true,
    stackable: false,
    welcomeGrant: false,
    missionPoolable: false,
    active: true,
    worth: null,
    requirement: null,
    unlockLevel: null,
  }
}

const form = ref<ItemForm>(blankForm())
const valueModel = ref<Record<string, unknown>>({})

const iconUrl = ref<string | null>(null)
const stagedIcon = ref<File | null>(null)
const stagedIconUrl = ref<string | null>(null)

const rarityOptions = RARITY_ORDER.map((r) => ({ value: r, label: r }))

const typeOptions = computed(() => [
  { value: '', label: 'All types' },
  ...itemTypeStore.itemTypes.map((t) => ({ value: t.id, label: `${t.name} (${t.key})` })),
])

const typeOptionsRequired = computed(() =>
  itemTypeStore.itemTypes
    .filter((t) => t.active)
    .map((t) => ({ value: t.id, label: `${t.name} (${t.key})` })),
)

const selectedType = computed(() => itemTypeStore.byId.get(form.value.typeId) ?? null)

const selectedTypeLabel = computed(() =>
  selectedType.value ? `${selectedType.value.name} (${selectedType.value.key})` : '—',
)

const selectedTypeSchema = computed<JsonSchema | null>(
  () => (selectedType.value?.valueSchema as JsonSchema | undefined) ?? null,
)

const visibleItems = computed(() =>
  typeFilter.value
    ? items.value.filter((i) => i.typeId === typeFilter.value)
    : items.value,
)

const nameCache = new Map<string, { id: string; name: string }[]>()

async function ensureNames(typeId: string): Promise<{ id: string; name: string }[]> {
  if (!typeId) return []
  const cached = nameCache.get(typeId)
  if (cached) return cached
  const list = await getAdminItems({ typeId, includeInactive: true })
  const mapped = list.map((i) => ({ id: i.id, name: i.name }))
  nameCache.set(typeId, mapped)
  return mapped
}

function isDuplicateName(candidate: string): boolean {
  const list = nameCache.get(form.value.typeId) ?? []
  const norm = candidate.trim().toLowerCase()
  return list.some((x) => x.id !== editing.value?.id && x.name.trim().toLowerCase() === norm)
}

async function fetchItems() {
  loading.value = true
  try {
    items.value = await getAdminItems({
      typeId: typeFilter.value || undefined,
      includeInactive: includeInactive.value || undefined,
    })
  } finally {
    loading.value = false
  }
}

function clearStagedIcon() {
  if (stagedIconUrl.value) URL.revokeObjectURL(stagedIconUrl.value)
  stagedIcon.value = null
  stagedIconUrl.value = null
}

function resetErrors() {
  formError.value = null
  nameError.value = null
  valueError.value = null
}

function openCreate() {
  editing.value = null
  form.value = blankForm(itemTypeStore.itemTypes.find((t) => t.active)?.id ?? '')
  valueModel.value = {}
  iconUrl.value = null
  clearStagedIcon()
  resetErrors()
  modalOpen.value = true
  if (form.value.typeId) void ensureNames(form.value.typeId)
}

function openEdit(item: ItemResponse) {
  editing.value = item
  form.value = {
    typeId: item.typeId,
    name: item.name,
    description: item.description ?? '',
    rarity: item.rarity,
    tradeable: item.tradeable,
    visible: item.visible,
    stackable: item.stackable,
    welcomeGrant: item.welcomeGrant,
    missionPoolable: item.missionPoolable,
    active: item.active,
    worth: item.worth,
    requirement: item.requirement,
    unlockLevel: item.unlockLevel,
  }
  valueModel.value = item.value ? { ...(item.value as unknown as Record<string, unknown>) } : {}
  iconUrl.value = item.iconUrl
  clearStagedIcon()
  resetErrors()
  modalOpen.value = true
  void ensureNames(item.typeId)
}

function closeModal() {
  clearStagedIcon()
  modalOpen.value = false
}

watch(
  () => form.value.typeId,
  (typeId) => {
    if (editing.value) return
    valueModel.value = {}
    valueError.value = null
    if (typeId) void ensureNames(typeId)
  },
)

function applyUpdatedItem(updated: ItemResponse) {
  const idx = items.value.findIndex((i) => i.id === updated.id)
  if (idx >= 0) items.value[idx] = updated
  if (editing.value?.id === updated.id) editing.value = updated
  const names = nameCache.get(updated.typeId)
  if (names) {
    const ni = names.findIndex((n) => n.id === updated.id)
    if (ni >= 0) names[ni] = { id: updated.id, name: updated.name }
    else names.push({ id: updated.id, name: updated.name })
  }
}

async function onIconUpload(file: File) {
  if (editing.value) {
    const updated = await uploadItemIcon(editing.value.id, file)
    iconUrl.value = updated.iconUrl
    applyUpdatedItem(updated)
  } else {
    clearStagedIcon()
    stagedIcon.value = file
    stagedIconUrl.value = URL.createObjectURL(file)
  }
}

async function onIconRemove() {
  if (editing.value) {
    const updated = await deleteItemIcon(editing.value.id)
    iconUrl.value = updated.iconUrl
    applyUpdatedItem(updated)
  } else {
    clearStagedIcon()
  }
}

const iconPreview = computed(() => (editing.value ? iconUrl.value : stagedIconUrl.value))

async function toggleActive() {
  if (!editing.value) return
  activeToggling.value = true
  resetErrors()
  try {
    if (editing.value.active) {
      await deleteItem(editing.value.id)
      applyUpdatedItem({ ...editing.value, active: false })
    } else {
      applyUpdatedItem(await reactivateItem(editing.value.id))
    }
  } catch (e) {
    formError.value = parseApiError(e, 'Failed to change active state').message
  } finally {
    activeToggling.value = false
  }
}

function buildValuePayload(): Record<string, unknown> | undefined {
  if (!selectedTypeSchema.value) return undefined
  return cleanValue(valueModel.value) as Record<string, unknown> | undefined
}

function mapError(e: unknown, fallback: string) {
  const parsed = parseApiError(e, fallback)
  if (parsed.fieldErrors.length) {
    for (const fe of parsed.fieldErrors) {
      if (fe.field === 'name') nameError.value = fe.message
      else if (fe.field === 'value' || fe.field.startsWith('value')) valueError.value = fe.message
    }
    formError.value = parsed.message
  } else if (parsed.status === 422) {
    valueError.value = parsed.message
  } else if (parsed.status === 500) {
    formError.value =
      'Unexpected server error. If another item in this type already uses this name, pick a different one.'
  } else {
    formError.value = parsed.message
  }
}

async function submit() {
  resetErrors()

  const name = form.value.name.trim()
  if (!name) {
    nameError.value = 'Name is required'
    return
  }
  try {
    await ensureNames(form.value.typeId)
  } catch {
    void 0
  }
  if (isDuplicateName(name)) {
    nameError.value = 'An item with this name already exists in this type'
    return
  }

  submitting.value = true
  try {
    const valuePayload = buildValuePayload()
    if (editing.value) {
      const req: UpdateItemRequest = {
        name,
        description: form.value.description.trim() || undefined,
        value: valuePayload,
        rarity: form.value.rarity,
        tradeable: form.value.tradeable,
        visible: form.value.visible,
        stackable: form.value.stackable,
        welcomeGrant: form.value.welcomeGrant,
        missionPoolable: form.value.missionPoolable,
        worth: form.value.worth,
        requirement: form.value.requirement,
        unlockLevel: form.value.unlockLevel,
      }
      applyUpdatedItem(await updateItem(editing.value.id, req))
    } else {
      const req: CreateItemRequest = {
        typeId: form.value.typeId,
        name,
        description: form.value.description.trim() || undefined,
        value: valuePayload,
        rarity: form.value.rarity,
        tradeable: form.value.tradeable,
        visible: form.value.visible,
        stackable: form.value.stackable,
        welcomeGrant: form.value.welcomeGrant,
        missionPoolable: form.value.missionPoolable,
        active: form.value.active,
        worth: form.value.worth,
        requirement: form.value.requirement,
        unlockLevel: form.value.unlockLevel,
      }
      let created = await createItem(req)
      if (stagedIcon.value) {
        try {
          created = await uploadItemIcon(created.id, stagedIcon.value)
        } catch (e) {
          formError.value = parseApiError(e, 'Item created, but icon upload failed').message
        }
      }
      items.value.unshift(created)
      const names = nameCache.get(created.typeId)
      if (names) names.push({ id: created.id, name: created.name })
    }
    closeModal()
  } catch (e) {
    mapError(e, 'Failed to save item')
  } finally {
    submitting.value = false
  }
}

const actionBusy = ref<Record<string, boolean>>({})

async function withBusy(id: string, fn: () => Promise<void>) {
  actionBusy.value[id] = true
  try {
    await fn()
  } finally {
    delete actionBusy.value[id]
  }
}

async function handleDeprecate(item: ItemResponse) {
  if (item.deprecated) return
  if (
    !confirm(
      `Deprecate "${item.name}"? This is permanent and irreversible, and stamps a "vintage" modifier on every copy players already own. There is no un-deprecate.`,
    )
  )
    return
  await withBusy(item.id, async () => {
    applyUpdatedItem(await deprecateItem(item.id))
  })
}

async function handleDelete(item: ItemResponse) {
  if (!confirm(`Delete "${item.name}"? This deactivates the item (reversible).`)) return
  await withBusy(item.id, async () => {
    await deleteItem(item.id)
    if (includeInactive.value) {
      applyUpdatedItem({ ...item, active: false })
    } else {
      items.value = items.value.filter((i) => i.id !== item.id)
    }
  })
}

async function handleReactivate(item: ItemResponse) {
  await withBusy(item.id, async () => {
    applyUpdatedItem(await reactivateItem(item.id))
  })
}

function onUnlockLevelInput(raw: string) {
  const n = parseNullableNumber(raw)
  form.value.unlockLevel = n == null ? null : Math.trunc(n)
}

watch([typeFilter, includeInactive], fetchItems)

onMounted(async () => {
  await itemTypeStore.fetchItemTypes()
  await fetchItems()
})
</script>

<template>
  <div class="items-mgmt">
    <header class="items-mgmt__bar">
      <BaseSelect v-model="typeFilter" :options="typeOptions" />
      <label class="items-mgmt__check">
        <input v-model="includeInactive" type="checkbox" /> Include inactive
      </label>
      <BaseButton variant="primary" size="sm" @click="openCreate">New item</BaseButton>
    </header>

    <AdminTable :items="visibleItems" :loading="loading" empty-message="No items">
      <template #head>
        <th>Name</th>
        <th>Type</th>
        <th>Rarity</th>
        <th>Flags</th>
        <th>Status</th>
        <th class="right">Actions</th>
      </template>

      <template #default="{ item }: { item: ItemResponse }">
        <td>
          <span class="items-mgmt__name">{{ item.name }}</span>
        </td>
        <td class="muted">{{ item.typeKey }}</td>
        <td>{{ item.rarity }}</td>
        <td>
          <div class="items-mgmt__flags">
            <span v-if="item.tradeable" class="items-mgmt__flag" title="Tradeable">Trade</span>
            <span v-if="item.welcomeGrant" class="items-mgmt__flag" title="Granted to new players">Welcome</span>
            <span v-if="item.missionPoolable" class="items-mgmt__flag" title="Eligible mission reward">Mission</span>
            <span v-if="item.stackable" class="items-mgmt__flag" title="Stackable">Stack</span>
          </div>
        </td>
        <td>
          <span v-if="!item.active">Inactive</span>
          <span v-else-if="item.deprecated">Deprecated</span>
          <span v-else-if="!item.visible">Hidden</span>
          <span v-else>Active</span>
        </td>
        <td class="right">
          <div class="items-mgmt__actions">
            <BaseButton size="sm" :disabled="actionBusy[item.id]" @click="openEdit(item)">Edit</BaseButton>
            <BaseButton
              v-if="item.active && !item.deprecated"
              size="sm"
              :loading="actionBusy[item.id]"
              @click="handleDeprecate(item)"
            >Deprecate</BaseButton>
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

    <BaseModal :open="modalOpen" :title="editing ? 'Edit item' : 'New item'" max-width="680px" @close="closeModal">
      <div class="items-mgmt__form">
        <BaseSelect
          v-if="!editing"
          v-model="form.typeId"
          :options="typeOptionsRequired"
          label="Type"
          searchable
        />
        <div v-else class="items-mgmt__readonly">
          <span class="items-mgmt__readonly-label">Type</span>
          <span class="items-mgmt__readonly-value">{{ selectedTypeLabel }}</span>
        </div>

        <BaseInput v-model="form.name" label="Name" :error="nameError ?? undefined" />

        <div class="items-mgmt__field">
          <label class="items-mgmt__field-label">Description</label>
          <textarea
            v-model="form.description"
            class="items-mgmt__textarea"
            rows="2"
            placeholder="Optional"
          />
        </div>

        <BaseSelect
          :model-value="form.rarity"
          :options="rarityOptions"
          label="Rarity"
          @update:model-value="(v: string) => form.rarity = v as ItemRarity"
        />

        <ImageUploader
          label="Icon"
          aspect-ratio="1 / 1"
          hint="PNG, WebP, etc. Stored on upload."
          :image-url="iconPreview"
          :upload-handler="onIconUpload"
          :remove-handler="onIconRemove"
        />

        <div v-if="selectedTypeSchema" class="items-mgmt__value">
          <label class="items-mgmt__field-label">Value</label>
          <SchemaValueForm
            :key="form.typeId"
            v-model="valueModel"
            :schema="selectedTypeSchema"
            :value-error="valueError"
          />
        </div>

        <div class="items-mgmt__check-grid">
          <label class="items-mgmt__check">
            <input v-model="form.tradeable" type="checkbox" /> Tradeable
          </label>
          <label class="items-mgmt__check">
            <input v-model="form.visible" type="checkbox" /> Visible
          </label>
          <label class="items-mgmt__check">
            <input v-model="form.stackable" type="checkbox" /> Stackable
          </label>
          <label class="items-mgmt__check">
            <input v-model="form.welcomeGrant" type="checkbox" /> Grant to every new player
          </label>
          <label class="items-mgmt__check">
            <input v-model="form.missionPoolable" type="checkbox" /> Eligible mission reward
          </label>
          <label v-if="!editing" class="items-mgmt__check">
            <input v-model="form.active" type="checkbox" /> Active
          </label>
          <label v-else class="items-mgmt__check items-mgmt__check--toggle">
            <input
              type="checkbox"
              :checked="editing.active"
              :disabled="activeToggling"
              @change="toggleActive"
            />
            Active <span class="items-mgmt__toggle-note">(applies immediately)</span>
          </label>
        </div>

        <div class="items-mgmt__num-grid">
          <BaseInput
            :model-value="form.worth == null ? '' : String(form.worth)"
            label="Worth (optional)"
            type="number"
            step="any"
            placeholder="e.g. 100"
            @update:model-value="(v) => form.worth = parseNullableNumber(String(v))"
          />
          <BaseInput
            :model-value="form.unlockLevel == null ? '' : String(form.unlockLevel)"
            label="Unlock level (optional)"
            type="number"
            step="1"
            placeholder="e.g. 50"
            @update:model-value="(v) => onUnlockLevelInput(String(v))"
          />
        </div>

        <BaseInput
          :model-value="form.requirement ?? ''"
          label="Requirement (optional)"
          placeholder="e.g. Reach level 50"
          @update:model-value="(v) => form.requirement = String(v).trim() || null"
        />

        <p v-if="formError" class="items-mgmt__form-error">{{ formError }}</p>
      </div>

      <template #footer>
        <BaseButton size="sm" @click="closeModal">Cancel</BaseButton>
        <BaseButton variant="primary" size="sm" :loading="submitting" @click="submit">
          {{ editing ? 'Save' : 'Create' }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.items-mgmt {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.items-mgmt__bar {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.items-mgmt__check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  cursor: pointer;
}

.items-mgmt__check-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-sm) var(--space-md);
}

.items-mgmt__toggle-note {
  color: var(--text-tertiary);
}

.items-mgmt__num-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-md);
}

.items-mgmt__name {
  font-weight: 500;
}

.items-mgmt__flags {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.items-mgmt__flag {
  padding: 1px var(--space-xs);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-pill);
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
}

.items-mgmt__actions {
  display: inline-flex;
  gap: var(--space-xs);
  justify-content: flex-end;
}

.items-mgmt__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.items-mgmt__field,
.items-mgmt__value {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.items-mgmt__field-label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.items-mgmt__textarea {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  resize: vertical;
  outline: none;
}

.items-mgmt__textarea:focus {
  border-color: var(--accent);
}

.items-mgmt__readonly {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.items-mgmt__readonly-label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.items-mgmt__readonly-value {
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: var(--text-body);
}

.items-mgmt__form-error {
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--error);
  background: color-mix(in srgb, var(--error) 10%, transparent);
  border-radius: var(--radius-input);
  color: var(--error);
  font-size: var(--text-caption);
}
</style>
