<script setup lang="ts">
import BaseDropdown from '@/components/common/BaseDropdown.vue'
import UnusualEffectTile from '@/components/domain/UnusualEffectTile.vue'
import { useCrateUnusualEffects } from '@/composables/useCrateUnusualEffects'
import { ref, useId, watch } from 'vue'

const props = defineProps<{
  crateId: string
}>()

const open = ref(false)
const panelId = useId()
const { effects, loading, load } = useCrateUnusualEffects(() => props.crateId)

watch(open, (isOpen) => {
  if (isOpen) load()
})
</script>

<template>
  <BaseDropdown
    class="unusual-pop"
    :open="open"
    position="bottom-left"
    @update:open="open = $event"
  >
    <template #trigger>
      <button
        type="button"
        class="unusual-pop__trigger"
        :class="{ 'unusual-pop__trigger--open': open }"
        :aria-expanded="open"
        :aria-describedby="open ? panelId : undefined"
        aria-label="Possible unusual effects"
      >
        ?
      </button>
    </template>

    <div :id="panelId" class="unusual-pop__panel" role="group" aria-label="Possible effects">
      <span class="unusual-pop__title">Possible effects</span>

      <p v-if="loading" class="unusual-pop__state">Loading&hellip;</p>
      <p v-else-if="effects.length === 0" class="unusual-pop__state">
        Rolls the default Unusual sparkle.
      </p>
      <template v-else>
        <p class="unusual-pop__note">On an Unusual roll you get one of these, equal chance.</p>
        <ul class="unusual-pop__list">
          <li v-for="effect in effects" :key="effect.id">
            <UnusualEffectTile :name="effect.name" :effect-spec="effect.effectSpec" :size="64" />
          </li>
        </ul>
      </template>
    </div>
  </BaseDropdown>
</template>

<style scoped>
.unusual-pop {
  display: inline-flex;
}

.unusual-pop__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: 50%;
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease;
}

.unusual-pop__trigger:hover,
.unusual-pop__trigger--open {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
  background: var(--bg-overlay);
}

.unusual-pop__trigger:focus-visible {
  outline: none;
  color: var(--text-primary);
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
}

.unusual-pop__panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  width: 232px;
  max-width: calc(100vw - var(--space-xl));
}

.unusual-pop__title {
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.unusual-pop__note {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-secondary);
  line-height: 1.4;
}

.unusual-pop__state {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.unusual-pop__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 280px;
  overflow-y: auto;
}
</style>
