<script setup lang="ts">
import FragmentedContent from '@/components/domain/FragmentedContent.vue'
import ItemPreview from '@/components/domain/ItemPreview.vue'
import type { ItemResponse } from '@/types/api/items'
import type { FragmentSpec } from '@/utils/items'

withDefaults(
  defineProps<{
    item: ItemResponse
    spec: FragmentSpec
    stack?: number
    selected?: boolean
  }>(),
  { stack: 1 },
)
</script>

<template>
  <FragmentedContent
    :spec="spec"
    :seed="item.id"
    :stack="stack"
    :subtle="item.typeKey === 'title'"
    measure-selector=".item-preview > *"
  >
    <ItemPreview :item="item" :selected="selected" />
  </FragmentedContent>
</template>
