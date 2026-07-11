import type {
  EquippedItemsResponse,
  ItemResponse,
  UnusualEffectRef,
  UserItemResponse,
} from '@/types/api/items'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

function placeholderItem(typeKey: string): ItemResponse {
  return {
    id: `preview-placeholder:${typeKey}`,
    typeId: '',
    typeKey,
    name: '',
    description: null,
    iconUrl: null,
    value: null,
    rarity: 'common',
    tradeable: false,
    visible: false,
    active: false,
    deprecated: false,
    stackable: false,
    welcomeGrant: false,
    missionPoolable: false,
    unlockLevel: null,
    worth: null,
    requirement: null,
    createdAt: '',
  }
}

function syntheticEntry(
  item: ItemResponse,
  opts?: { unusualEffect?: UnusualEffectRef | null; variantKey?: string | null },
): UserItemResponse {
  return {
    linkId: `preview:${item.id}`,
    item,
    modifiers: [],
    unusualEffect: opts?.unusualEffect ?? null,
    serialNumber: null,
    quantity: 0,
    source: 'manual',
    sourceId: null,
    awardedByStaffId: null,
    reason: null,
    awardedAt: '',
    variantKey: opts?.variantKey ?? null,
  }
}

export const usePreviewStore = defineStore('creativesPreview', () => {
  const active = ref(false)

  const borderShape = ref<ItemResponse | null>(null)
  const borderShapeVariant = ref<string | null>(null)
  const borderShapeEffect = ref<UnusualEffectRef | null>(null)

  const borderColor = ref<ItemResponse | null>(null)
  const borderColorVariant = ref<string | null>(null)
  const borderColorEffect = ref<UnusualEffectRef | null>(null)

  const title = ref<ItemResponse | null>(null)
  const titleVariant = ref<string | null>(null)
  const titleEffect = ref<UnusualEffectRef | null>(null)

  const theme = ref<ItemResponse | null>(null)

  const overrides = computed<EquippedItemsResponse>(() => {
    const result: EquippedItemsResponse = {}

    if (borderShape.value || borderShapeEffect.value) {
      result.profile_border_shape = syntheticEntry(
        borderShape.value ?? placeholderItem('profile_border_shape'),
        { variantKey: borderShapeVariant.value, unusualEffect: borderShapeEffect.value },
      )
    }
    if (borderColor.value || borderColorEffect.value) {
      result.profile_border_color = syntheticEntry(
        borderColor.value ?? placeholderItem('profile_border_color'),
        { variantKey: borderColorVariant.value, unusualEffect: borderColorEffect.value },
      )
    }
    if (title.value || titleEffect.value) {
      result.title = syntheticEntry(title.value ?? placeholderItem('title'), {
        variantKey: titleVariant.value,
        unusualEffect: titleEffect.value,
      })
    }
    return result
  })

  return {
    active,
    borderShape,
    borderShapeVariant,
    borderShapeEffect,
    borderColor,
    borderColorVariant,
    borderColorEffect,
    title,
    titleVariant,
    titleEffect,
    theme,
    overrides,
  }
})
