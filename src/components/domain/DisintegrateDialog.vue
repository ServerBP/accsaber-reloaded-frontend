<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import type { UserItemResponse } from '@/types/api/items'
import { formatEssence } from '@/utils/essence'
import { displayItemName } from '@/utils/items'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  userItem: UserItemResponse | null
  busy?: boolean
}>()

const emit = defineEmits<{
  confirm: [quantity: number]
  cancel: []
}>()

const owned = computed(() => props.userItem?.quantity ?? 1)
const worth = computed(() => props.userItem?.item.worth ?? 0)
const stackable = computed(() => owned.value > 1)
const itemName = computed(() =>
  props.userItem ? displayItemName(props.userItem.modifiers, props.userItem.item.name) : '',
)

const selectedQty = ref(1)
const previewEssence = computed(() => worth.value * selectedQty.value)

watch(
  () => props.open,
  (open) => {
    if (open) selectedQty.value = owned.value
  },
  { immediate: true },
)

function setQty(next: number): void {
  if (!Number.isFinite(next)) return
  selectedQty.value = Math.min(owned.value, Math.max(1, Math.round(next)))
}

function onInput(event: Event): void {
  setQty(Number((event.target as HTMLInputElement).value))
}

function onConfirm(): void {
  if (props.busy) return
  emit('confirm', selectedQty.value)
}
</script>

<template>
  <BaseModal :open="open" title="Disintegrate" max-width="440px" @close="emit('cancel')">
    <div class="disintegrate">
      <p class="disintegrate__lead">
        Disintegrate <strong>{{ itemName }}</strong
        >? This is permanent and cannot be undone.
      </p>

      <div v-if="stackable" class="disintegrate__qty">
        <span class="disintegrate__qty-label">Quantity</span>
        <div class="disintegrate__stepper">
          <button
            type="button"
            class="disintegrate__step"
            aria-label="Decrease quantity"
            :disabled="busy || selectedQty <= 1"
            @click="setQty(selectedQty - 1)"
          >
            &minus;
          </button>
          <input
            class="disintegrate__input"
            type="number"
            inputmode="numeric"
            :min="1"
            :max="owned"
            :value="selectedQty"
            :disabled="busy"
            aria-label="Quantity to disintegrate"
            @change="onInput"
          />
          <button
            type="button"
            class="disintegrate__step"
            aria-label="Increase quantity"
            :disabled="busy || selectedQty >= owned"
            @click="setQty(selectedQty + 1)"
          >
            +
          </button>
        </div>
        <span class="disintegrate__qty-hint">of {{ owned }}</span>
      </div>

      <p class="disintegrate__yield">
        You will receive <strong>{{ formatEssence(previewEssence) }}</strong> essence.
      </p>
    </div>

    <template #footer>
      <BaseButton size="md" :disabled="busy" @click="emit('cancel')">Cancel</BaseButton>
      <BaseButton variant="destructive" size="md" :loading="busy" @click="onConfirm">
        Disintegrate
      </BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.disintegrate {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.disintegrate__lead {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-body);
  line-height: 1.5;
}

.disintegrate__lead strong {
  color: var(--text-primary);
  font-weight: 600;
}

.disintegrate__qty {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.disintegrate__qty-label {
  font-size: var(--text-caption);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.disintegrate__stepper {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  overflow: hidden;
}

.disintegrate__step {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 1rem;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.disintegrate__step:hover:not(:disabled) {
  background: var(--bg-elevated);
}

.disintegrate__step:disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.disintegrate__input {
  width: 56px;
  padding: var(--space-xs) 0;
  text-align: center;
  background: var(--bg-base);
  border: none;
  border-left: 1px solid var(--bg-overlay);
  border-right: 1px solid var(--bg-overlay);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-body);
}

.disintegrate__input:focus {
  outline: none;
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--error) 30%, transparent);
}

.disintegrate__input::-webkit-inner-spin-button,
.disintegrate__input::-webkit-outer-spin-button {
  appearance: none;
  margin: 0;
}

.disintegrate__qty-hint {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.disintegrate__yield {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-body);
}

.disintegrate__yield strong {
  color: var(--tier-gold);
  font-weight: 600;
}
</style>
