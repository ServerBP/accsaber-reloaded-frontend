<script setup lang="ts">
import FragmentedItem from '@/components/domain/FragmentedItem.vue'
import ItemPreview from '@/components/domain/ItemPreview.vue'
import ModifierCompositions from '@/components/domain/ModifierCompositions.vue'
import type { ItemResponse, ModifierEffectSpec } from '@/types/api/items'
import { readFragmentSpec } from '@/utils/items'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    effectSpec: ModifierEffectSpec | null
    size?: number
  }>(),
  { size: 96 },
)

const fragmentSpec = computed(() =>
  readFragmentSpec({ id: 'preview', key: 'preview', name: props.name, effectSpec: props.effectSpec }),
)

const SAMPLE_GRAY = '#9b9ba4'

const SAMPLE_ITEM: ItemResponse = {
  id: 'unusual-effect-sample',
  typeId: '',
  typeKey: 'profile_border_color',
  name: 'Example item',
  description: null,
  iconUrl: null,
  value: { states: [{ atMs: 0, fill: { type: 'solid', hex: SAMPLE_GRAY } }] },
  rarity: 'common',
  tradeable: false,
  visible: true,
  active: true,
  deprecated: false,
  stackable: false,
  welcomeGrant: false,
  missionPoolable: false,
  unlockLevel: null,
  worth: null,
  requirement: null,
  createdAt: '',
}
</script>

<template>
  <figure class="ue-tile" :style="{ '--ue-tile-size': `${size}px` }" :title="name">
    <span class="ue-tile__frame">
      <FragmentedItem v-if="fragmentSpec" :item="SAMPLE_ITEM" :spec="fragmentSpec" :selected="true" />
      <ItemPreview v-else :item="SAMPLE_ITEM" />
      <ModifierCompositions
        v-if="effectSpec"
        :spec="effectSpec"
        type-key="profile_border_color"
        measure-selector=".item-preview > *"
      />
    </span>
    <figcaption class="ue-tile__name">{{ name }}</figcaption>
  </figure>
</template>

<style scoped>
.ue-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: var(--ue-tile-size);
  margin: 0;
}

.ue-tile__frame {
  position: relative;
  display: block;
  width: var(--ue-tile-size);
  height: var(--ue-tile-size);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-input);
  overflow: hidden;
}

.ue-tile__name {
  font-size: 0.6875rem;
  color: var(--text-primary);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
