<script setup lang="ts">
import { patchAdminItemModifier } from '@/api/admin/items'
import { getItemModifiers } from '@/api/items'
import { parseApiError } from '@/api/client'
import AdminTable from '@/components/admin/AdminTable.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseSelect from '@/components/common/BaseSelect.vue'
import type {
  ItemModifierResponse,
  PatchItemModifierRequest,
} from '@/types/api/items'
import {
  decimalToPercent,
  formatChancePercent,
  formatSeasonWindow,
  MONTH_OPTIONS,
  maxDayForMonth,
  parseMonthDay,
  percentToDecimal,
  toMonthDay,
} from '@/utils/modifiers'
import { computed, onMounted, ref } from 'vue'

const modifiers = ref<ItemModifierResponse[]>([])
const loading = ref(false)

const editing = ref<ItemModifierResponse | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

const form = ref({
  rollsGlobally: false,
  chancePct: '',
  seasonal: false,
  startMonth: '10',
  startDay: '25',
  endMonth: '11',
  endDay: '1',
})

async function fetchModifiers() {
  loading.value = true
  try {
    modifiers.value = await getItemModifiers()
  } finally {
    loading.value = false
  }
}

function openEdit(mod: ItemModifierResponse) {
  editing.value = mod
  formError.value = null
  fieldErrors.value = {}
  const start = parseMonthDay(mod.seasonStart)
  const end = parseMonthDay(mod.seasonEnd)
  form.value = {
    rollsGlobally: mod.globalDropChance != null,
    chancePct:
      mod.globalDropChance != null ? String(decimalToPercent(mod.globalDropChance)) : '',
    seasonal: !!(mod.seasonStart && mod.seasonEnd),
    startMonth: String(start?.month ?? 10),
    startDay: String(start?.day ?? 25),
    endMonth: String(end?.month ?? 11),
    endDay: String(end?.day ?? 1),
  }
}

function closeEdit() {
  editing.value = null
}

function buildPayload(): PatchItemModifierRequest | null {
  fieldErrors.value = {}
  formError.value = null

  if (!form.value.rollsGlobally) {
    return { globalDropChance: null, seasonStart: null, seasonEnd: null }
  }

  const chanceStr = String(form.value.chancePct).trim()
  const pct = Number(chanceStr)
  if (!chanceStr || !Number.isFinite(pct) || pct <= 0 || pct > 100) {
    fieldErrors.value.globalDropChance = 'Enter a percentage between 0 (exclusive) and 100.'
    return null
  }

  if (!form.value.seasonal) {
    return {
      globalDropChance: percentToDecimal(pct),
      seasonStart: null,
      seasonEnd: null,
    }
  }

  const startMonth = Number(form.value.startMonth)
  const startDay = Number(form.value.startDay)
  const endMonth = Number(form.value.endMonth)
  const endDay = Number(form.value.endDay)

  if (startDay < 1 || startDay > maxDayForMonth(startMonth)) {
    fieldErrors.value.seasonStart = 'Invalid day for the selected month.'
    return null
  }
  if (endDay < 1 || endDay > maxDayForMonth(endMonth)) {
    fieldErrors.value.seasonEnd = 'Invalid day for the selected month.'
    return null
  }

  return {
    globalDropChance: percentToDecimal(pct),
    seasonStart: toMonthDay(startMonth, startDay),
    seasonEnd: toMonthDay(endMonth, endDay),
  }
}

async function save() {
  if (!editing.value) return
  const payload = buildPayload()
  if (!payload) return
  saving.value = true
  try {
    const updated = await patchAdminItemModifier(editing.value.id, payload)
    modifiers.value = modifiers.value.map((m) => (m.id === updated.id ? updated : m))
    closeEdit()
  } catch (e) {
    const parsed = parseApiError(e, 'Failed to update modifier')
    if (parsed.fieldErrors.length) {
      for (const fe of parsed.fieldErrors) fieldErrors.value[fe.field] = fe.message
    }
    formError.value = parsed.message
  } finally {
    saving.value = false
  }
}

const dayHint = computed(() => ({
  start: maxDayForMonth(Number(form.value.startMonth)),
  end: maxDayForMonth(Number(form.value.endMonth)),
}))

onMounted(fetchModifiers)
</script>

<template>
  <div class="modifiers-tab">
    <p class="modifiers-tab__hint">
      Configure each modifier's global seasonal roll. Global drops only apply when opening a crate.
    </p>

    <AdminTable :items="modifiers" :loading="loading" empty-message="No modifiers">
      <template #head>
        <th>Name</th>
        <th>Key</th>
        <th class="right">Global chance</th>
        <th>Season</th>
        <th></th>
      </template>

      <template #default="{ item }: { item: ItemModifierResponse }">
        <td>
          <span class="modifiers-tab__name">
            <span
              class="modifiers-tab__chip"
              :style="{ background: item.colorHex }"
              aria-hidden="true"
            />
            {{ item.name }}
          </span>
        </td>
        <td class="mono">{{ item.key }}</td>
        <td class="right mono">
          <span v-if="item.globalDropChance != null">
            {{ formatChancePercent(item.globalDropChance) }}
          </span>
          <span v-else class="muted">Off</span>
        </td>
        <td class="muted">
          <span v-if="item.globalDropChance != null">
            {{ formatSeasonWindow(item.seasonStart, item.seasonEnd) }}
          </span>
          <span v-else>-</span>
        </td>
        <td class="right">
          <BaseButton size="sm" @click="openEdit(item)">Edit</BaseButton>
        </td>
      </template>
    </AdminTable>

    <BaseModal
      :open="!!editing"
      :title="editing ? `Edit ${editing.name}` : ''"
      max-width="520px"
      @close="closeEdit"
    >
      <div v-if="editing" class="modifiers-tab__form">
        <label class="modifiers-tab__toggle">
          <input v-model="form.rollsGlobally" type="checkbox" />
          <span>Rolls globally</span>
        </label>
        <p class="modifiers-tab__note">
          Global drops only apply when opening a crate. Turn this off to disable global rolling
          entirely.
        </p>

        <fieldset class="modifiers-tab__fieldset" :disabled="!form.rollsGlobally">
          <label class="modifiers-tab__label" for="global-chance">Global drop chance (%)</label>
          <input
            id="global-chance"
            v-model="form.chancePct"
            type="number"
            min="0"
            max="100"
            step="any"
            class="modifiers-tab__number"
            :class="{ 'modifiers-tab__number--error': fieldErrors.globalDropChance }"
          />
          <p v-if="fieldErrors.globalDropChance" class="modifiers-tab__field-error">
            {{ fieldErrors.globalDropChance }}
          </p>

          <label class="modifiers-tab__toggle modifiers-tab__toggle--sub">
            <input v-model="form.seasonal" type="checkbox" />
            <span>Limit to a season window</span>
          </label>
          <p class="modifiers-tab__note">
            When off, the modifier rolls year-round. A window may wrap the year end
            (e.g. Dec 20 → Jan 5).
          </p>

          <div v-if="form.seasonal" class="modifiers-tab__season">
            <div class="modifiers-tab__season-row">
              <span class="modifiers-tab__label">Season start</span>
              <div class="modifiers-tab__md">
                <BaseSelect v-model="form.startMonth" :options="MONTH_OPTIONS" />
                <input
                  v-model="form.startDay"
                  type="number"
                  min="1"
                  :max="dayHint.start"
                  class="modifiers-tab__day"
                  aria-label="Start day"
                />
              </div>
              <p v-if="fieldErrors.seasonStart" class="modifiers-tab__field-error">
                {{ fieldErrors.seasonStart }}
              </p>
            </div>

            <div class="modifiers-tab__season-row">
              <span class="modifiers-tab__label">Season end</span>
              <div class="modifiers-tab__md">
                <BaseSelect v-model="form.endMonth" :options="MONTH_OPTIONS" />
                <input
                  v-model="form.endDay"
                  type="number"
                  min="1"
                  :max="dayHint.end"
                  class="modifiers-tab__day"
                  aria-label="End day"
                />
              </div>
              <p v-if="fieldErrors.seasonEnd" class="modifiers-tab__field-error">
                {{ fieldErrors.seasonEnd }}
              </p>
            </div>
          </div>
        </fieldset>

        <p v-if="formError" class="modifiers-tab__error">{{ formError }}</p>
      </div>

      <template #footer>
        <BaseButton size="sm" @click="closeEdit">Cancel</BaseButton>
        <BaseButton variant="primary" size="sm" :loading="saving" @click="save">
          Save
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.modifiers-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.modifiers-tab__hint {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.modifiers-tab__name {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  font-weight: 500;
}

.modifiers-tab__chip {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-badge);
  border: 1px solid color-mix(in srgb, var(--text-primary) 20%, transparent);
  flex-shrink: 0;
}

.modifiers-tab__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.modifiers-tab__toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--text-body);
  color: var(--text-primary);
  cursor: pointer;
}

.modifiers-tab__toggle--sub {
  margin-top: var(--space-sm);
  font-size: var(--text-caption);
}

.modifiers-tab__note {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  line-height: 1.4;
}

.modifiers-tab__fieldset {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  border: none;
  padding: 0;
  margin: 0;
}

.modifiers-tab__fieldset:disabled {
  opacity: 0.5;
}

.modifiers-tab__label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.modifiers-tab__number,
.modifiers-tab__day {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-body);
  outline: none;
}

.modifiers-tab__number {
  width: 140px;
}

.modifiers-tab__number:focus,
.modifiers-tab__day:focus {
  border-color: var(--accent);
}

.modifiers-tab__number--error {
  border-color: var(--error);
}

.modifiers-tab__season {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-top: var(--space-xs);
}

.modifiers-tab__season-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.modifiers-tab__md {
  display: flex;
  align-items: flex-end;
  gap: var(--space-sm);
}

.modifiers-tab__day {
  width: 80px;
}

.modifiers-tab__field-error {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--error);
}

.modifiers-tab__error {
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--error);
  background: color-mix(in srgb, var(--error) 12%, transparent);
  color: var(--error);
  border-radius: var(--radius-card);
  font-size: var(--text-caption);
}
</style>
