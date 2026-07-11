<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import UserPicker from '@/components/domain/UserPicker.vue'
import { awardItem, getAdminItems } from '@/api/admin/items'
import { getUnusualEffects } from '@/api/items'
import { useItemModifierStore } from '@/stores/itemModifiers'
import { useItemTypeStore } from '@/stores/itemTypes'
import type {
  AwardItemRequest,
  ItemResponse,
  UnusualEffectResponse,
  UserItemResponse,
} from '@/types/api/items'
import { computed, onMounted, ref, watch } from 'vue'

const UNUSUAL_MODIFIER_KEY = 'unusual'

const itemTypeStore = useItemTypeStore()
const modifierStore = useItemModifierStore()

const userId = ref<string | null>(null)
const itemId = ref<string>('')
const modifierKeys = ref<string[]>([])
const unusualEffectId = ref<string>('')
const quantity = ref<number>(1)
const reason = ref<string>('')
const typeFilter = ref<string>('')
const items = ref<ItemResponse[]>([])
const unusualEffects = ref<UnusualEffectResponse[]>([])
const itemsLoading = ref(false)
const submitting = ref(false)

const status = ref<{ kind: 'success' | 'error'; message: string; awarded?: UserItemResponse } | null>(null)

const typeOptions = computed(() => [
  { value: '', label: 'All types' },
  ...itemTypeStore.itemTypes.filter((t) => t.active).map((t) => ({ value: t.id, label: t.name })),
])

const itemOptions = computed(() => {
  const filtered = typeFilter.value
    ? items.value.filter((i) => i.typeId === typeFilter.value)
    : items.value
  return [
    { value: '', label: 'Select an item...' },
    ...filtered.map((i) => ({ value: i.id, label: `${i.name} (${i.typeKey}, ${i.rarity})` })),
  ]
})

const activeModifiers = computed(() => modifierStore.modifiers.filter((m) => m.active))

const unusualSelected = computed(() => modifierKeys.value.includes(UNUSUAL_MODIFIER_KEY))

const unusualEffectOptions = computed(() => [
  { value: '', label: 'None (default sparkle)' },
  ...unusualEffects.value.map((e) => ({
    value: e.id,
    label: e.name || e.key,
    description: e.description ?? undefined,
  })),
])

const selectedItem = computed<ItemResponse | null>(
  () => items.value.find((i) => i.id === itemId.value) ?? null,
)

const isStackable = computed(() => !!selectedItem.value?.stackable)

const canSubmit = computed(
  () => !!userId.value && !!itemId.value && quantity.value >= 1 && !submitting.value,
)

function toggleModifier(key: string) {
  if (modifierKeys.value.includes(key)) {
    modifierKeys.value = modifierKeys.value.filter((k) => k !== key)
  } else {
    modifierKeys.value = [...modifierKeys.value, key]
  }
}

async function fetchItems() {
  itemsLoading.value = true
  try {
    items.value = await getAdminItems({ includeInactive: false })
  } finally {
    itemsLoading.value = false
  }
}

async function fetchUnusualEffects() {
  unusualEffects.value = await getUnusualEffects()
}

async function submit() {
  if (!userId.value || !itemId.value) return
  submitting.value = true
  status.value = null
  try {
    const req: AwardItemRequest = {
      userId: userId.value,
      itemId: itemId.value,
      reason: reason.value.trim() || undefined,
      modifierKeys: modifierKeys.value.length ? [...modifierKeys.value] : undefined,
      unusualEffectId:
        unusualSelected.value && unusualEffectId.value ? unusualEffectId.value : undefined,
      quantity: isStackable.value ? Math.max(1, Math.floor(quantity.value)) : 1,
    }
    const awarded = await awardItem(req)
    status.value = {
      kind: 'success',
      message: `Awarded "${awarded.item.name}" successfully.`,
      awarded,
    }
    itemId.value = ''
    reason.value = ''
    modifierKeys.value = []
    unusualEffectId.value = ''
    quantity.value = 1
  } catch (e) {
    status.value = { kind: 'error', message: (e as Error).message || 'Award failed' }
  } finally {
    submitting.value = false
  }
}

watch(isStackable, (stackable) => {
  if (!stackable) quantity.value = 1
})

watch(unusualSelected, (selected) => {
  if (!selected) {
    unusualEffectId.value = ''
  } else if (!unusualEffectId.value && unusualEffects.value.length) {
    unusualEffectId.value = unusualEffects.value[0].id
  }
})

onMounted(async () => {
  await Promise.all([
    itemTypeStore.fetchItemTypes(),
    modifierStore.fetchModifiers(),
    fetchItems(),
    fetchUnusualEffects(),
  ])
})
</script>

<template>
  <div class="award-tab">
    <div class="award-tab__form">
      <div class="award-tab__field">
        <label class="award-tab__label">User</label>
        <UserPicker v-model="userId" />
      </div>

      <BaseSelect
        v-model="typeFilter"
        :options="typeOptions"
        label="Filter by type"
      />

      <BaseSelect
        v-model="itemId"
        :options="itemOptions"
        label="Item"
        searchable
      />

      <div class="award-tab__field">
        <label class="award-tab__label">Modifiers (leave empty to auto-resolve)</label>
        <div class="award-tab__modifier-chips">
          <button
            v-for="m in activeModifiers"
            :key="m.key"
            type="button"
            class="award-tab__modifier-chip"
            :class="{ 'award-tab__modifier-chip--active': modifierKeys.includes(m.key) }"
            :style="modifierKeys.includes(m.key) && m.colorHex ? { borderColor: m.colorHex, color: m.colorHex } : undefined"
            @click="toggleModifier(m.key)"
          >{{ m.name }}</button>
        </div>
        <p v-if="!modifierKeys.length" class="award-tab__hint">
          Non-stackable items auto-resolve to founders/seasonal/normal. Stackable items default to "normal".
        </p>
      </div>

      <div v-if="unusualSelected" class="award-tab__field">
        <BaseSelect
          v-model="unusualEffectId"
          :options="unusualEffectOptions"
          label="Unusual effect"
          searchable
        />
        <p class="award-tab__hint">
          Choose which unusual effect this item receives. Pick "None" to leave it on the
          default sparkle.
        </p>
      </div>

      <div class="award-tab__field">
        <label class="award-tab__label">Quantity</label>
        <input
          v-model.number="quantity"
          type="number"
          min="1"
          class="award-tab__qty-input"
          :disabled="!isStackable"
        />
        <p v-if="!isStackable && selectedItem" class="award-tab__hint">
          This item is not stackable. Quantity is forced to 1.
        </p>
      </div>

      <BaseInput v-model="reason" label="Reason (optional)" />

      <div class="award-tab__actions">
        <BaseButton variant="primary" :disabled="!canSubmit" :loading="submitting" @click="submit">
          Award item
        </BaseButton>
      </div>

      <div
        v-if="status"
        class="award-tab__status"
        :class="status.kind === 'success' ? 'award-tab__status--ok' : 'award-tab__status--err'"
      >
        {{ status.message }}
        <span v-if="status.awarded" class="award-tab__status-meta">
          Link {{ status.awarded.linkId }}
          <span v-if="status.awarded.serialNumber != null"> · #{{ status.awarded.serialNumber }}</span>
          <span v-if="status.awarded.quantity > 1"> · x{{ status.awarded.quantity }}</span>
        </span>
      </div>
    </div>

    <p v-if="itemsLoading" class="award-tab__hint">Loading items...</p>
  </div>
</template>

<style scoped>
.award-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 560px;
}

.award-tab__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.award-tab__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.award-tab__label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.award-tab__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-sm);
}

.award-tab__status {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-card);
  font-size: var(--text-caption);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.award-tab__status--ok {
  background: color-mix(in srgb, var(--success) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--success) 30%, transparent);
  color: var(--success);
}

.award-tab__status--err {
  background: color-mix(in srgb, var(--error) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 30%, transparent);
  color: var(--error);
}

.award-tab__status-meta {
  font-family: var(--font-mono);
  color: var(--text-tertiary);
}

.award-tab__hint {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.award-tab__modifier-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.award-tab__modifier-chip {
  padding: 4px 10px;
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
}

.award-tab__modifier-chip:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.award-tab__modifier-chip--active {
  color: var(--accent);
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.award-tab__qty-input {
  width: 120px;
  padding: var(--space-xs) var(--space-sm);
  background: var(--bg-base);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-body);
  outline: none;
}

.award-tab__qty-input:focus {
  border-color: var(--accent);
}

.award-tab__qty-input:disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
}
</style>
