<script setup lang="ts">
import BaseButton from '@/components/common/BaseButton.vue'
import CrateOpenAnimation from '@/components/domain/CrateOpenAnimation.vue'
import CrateOpenStage from '@/components/domain/CrateOpenStage.vue'
import type {
  CrateContentResponse,
  CrateModifierResponse,
  ItemModifierResponse,
  ItemResponse,
  UnusualEffectRef,
  UserItemResponse,
} from '@/types/api/items'
import { isEquippableTypeKey } from '@/utils/items'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  crate: ItemResponse
  contents: CrateContentResponse[]
  crateModifiers: CrateModifierResponse[]
  globalModifiers: ItemModifierResponse[]
  unusualEffects: UnusualEffectRef[]
  result: UserItemResponse | null
  error: string | null
  busy: boolean
  canOpenAnother: boolean
  equipBusy?: boolean
  equippedLinkId?: string | null
}>()

const emit = defineEmits<{
  close: []
  openAnother: []
  equip: [reward: UserItemResponse]
  opened: []
}>()

const animRef = ref<InstanceType<typeof CrateOpenAnimation> | null>(null)
const playToken = ref(0)
const revealed = ref(false)

watch(
  () => props.result,
  (res) => {
    if (!res) return
    revealed.value = false
    playToken.value++
  },
  { immediate: true },
)

const settled = computed(() => revealed.value || !!props.error)

function onOpened() {
  revealed.value = true
  emit('opened')
}

const reward = computed(() => props.result)
const rewardEquippable = computed(() => {
  const it = reward.value?.item
  return !!it && isEquippableTypeKey(it.typeKey) && it.active && !it.deprecated
})
const rewardEquipped = computed(
  () => !!reward.value && props.equippedLinkId === reward.value.linkId,
)

function dismiss() {
  if (props.result && !settled.value) animRef.value?.skip()
  else emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') dismiss()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <CrateOpenStage :ready="settled" :label="`Opening ${crate.name}`" @dismiss="dismiss">
    <template #title>{{ crate.name }}</template>

    <CrateOpenAnimation
      ref="animRef"
      :contents="contents"
      :crate-modifiers="crateModifiers"
      :global-modifiers="globalModifiers"
      :unusual-effects="unusualEffects"
      :result="result?.item ?? null"
      :result-modifiers="result?.modifiers ?? []"
      :result-unusual-effect="result?.unusualEffect ?? null"
      :result-serial-number="result?.serialNumber ?? null"
      :play-token="playToken"
      :height="320"
      @complete="onOpened"
    />

    <p v-if="error" class="crate-open__error" role="alert">{{ error }}</p>

    <template #actions>
      <BaseButton
        v-if="reward && rewardEquippable && !rewardEquipped && !error"
        variant="primary"
        :loading="equipBusy"
        :disabled="!settled"
        @click="emit('equip', reward)"
      >
        Equip
      </BaseButton>
      <span v-else-if="reward && rewardEquippable && rewardEquipped" class="crate-open__equipped">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Equipped
      </span>
      <BaseButton
        v-if="canOpenAnother && !error"
        :variant="rewardEquippable ? 'default' : 'primary'"
        :loading="busy"
        :disabled="!settled"
        @click="emit('openAnother')"
      >
        Open another
      </BaseButton>
      <BaseButton :disabled="!settled" @click="emit('close')">Done</BaseButton>
    </template>
  </CrateOpenStage>
</template>

<style scoped>
.crate-open__error {
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  background: color-mix(in srgb, var(--error) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--error) 30%, transparent);
  border-radius: var(--radius-card);
  color: var(--error);
  font-size: var(--text-caption);
}

.crate-open__equipped {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 0 var(--space-md);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: var(--radius-btn);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
</style>
