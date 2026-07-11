import type {
  EquippedItemsResponse,
  ItemModifierRef,
  ItemResponse,
  UnusualEffectRef,
  UserItemResponse,
} from '@/types/api/items'
import { isCreativesSubdomain } from '@/utils/subdomain'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

const STORAGE_KEY = 'creatives:preview'

interface PreviewSnapshot {
  active: boolean
  borderShape: ItemResponse | null
  borderShapeVariant: string | null
  borderShapeEffect: UnusualEffectRef | null
  borderShapeModifiers: ItemModifierRef[]
  borderColor: ItemResponse | null
  borderColorVariant: string | null
  borderColorEffect: UnusualEffectRef | null
  borderColorModifiers: ItemModifierRef[]
  title: ItemResponse | null
  titleVariant: string | null
  titleEffect: UnusualEffectRef | null
  titleModifiers: ItemModifierRef[]
  theme: ItemResponse | null
}

function loadSnapshot(): Partial<PreviewSnapshot> {
  if (!isCreativesSubdomain) return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<PreviewSnapshot>) : {}
  } catch {
    return {}
  }
}

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
  opts?: {
    unusualEffect?: UnusualEffectRef | null
    variantKey?: string | null
    modifiers?: ItemModifierRef[]
  },
): UserItemResponse {
  return {
    linkId: `preview:${item.id}`,
    item,
    modifiers: opts?.modifiers ?? [],
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
  const saved = loadSnapshot()

  const active = ref(saved.active ?? false)

  const borderShape = ref<ItemResponse | null>(saved.borderShape ?? null)
  const borderShapeVariant = ref<string | null>(saved.borderShapeVariant ?? null)
  const borderShapeEffect = ref<UnusualEffectRef | null>(saved.borderShapeEffect ?? null)
  const borderShapeModifiers = ref<ItemModifierRef[]>(saved.borderShapeModifiers ?? [])

  const borderColor = ref<ItemResponse | null>(saved.borderColor ?? null)
  const borderColorVariant = ref<string | null>(saved.borderColorVariant ?? null)
  const borderColorEffect = ref<UnusualEffectRef | null>(saved.borderColorEffect ?? null)
  const borderColorModifiers = ref<ItemModifierRef[]>(saved.borderColorModifiers ?? [])

  const title = ref<ItemResponse | null>(saved.title ?? null)
  const titleVariant = ref<string | null>(saved.titleVariant ?? null)
  const titleEffect = ref<UnusualEffectRef | null>(saved.titleEffect ?? null)
  const titleModifiers = ref<ItemModifierRef[]>(saved.titleModifiers ?? [])

  const theme = ref<ItemResponse | null>(saved.theme ?? null)

  const overrides = computed<EquippedItemsResponse>(() => {
    const result: EquippedItemsResponse = {}

    if (borderShape.value || borderShapeEffect.value || borderShapeModifiers.value.length) {
      result.profile_border_shape = syntheticEntry(
        borderShape.value ?? placeholderItem('profile_border_shape'),
        {
          variantKey: borderShapeVariant.value,
          unusualEffect: borderShapeEffect.value,
          modifiers: borderShapeModifiers.value,
        },
      )
    }
    if (borderColor.value || borderColorEffect.value || borderColorModifiers.value.length) {
      result.profile_border_color = syntheticEntry(
        borderColor.value ?? placeholderItem('profile_border_color'),
        {
          variantKey: borderColorVariant.value,
          unusualEffect: borderColorEffect.value,
          modifiers: borderColorModifiers.value,
        },
      )
    }
    if (title.value || titleEffect.value || titleModifiers.value.length) {
      result.title = syntheticEntry(title.value ?? placeholderItem('title'), {
        variantKey: titleVariant.value,
        unusualEffect: titleEffect.value,
        modifiers: titleModifiers.value,
      })
    }
    return result
  })

  if (isCreativesSubdomain) {
    let canPersist = true
    watch(
      [
        active,
        borderShape,
        borderShapeVariant,
        borderShapeEffect,
        borderShapeModifiers,
        borderColor,
        borderColorVariant,
        borderColorEffect,
        borderColorModifiers,
        title,
        titleVariant,
        titleEffect,
        titleModifiers,
        theme,
      ],
      () => {
        if (!canPersist) return
        try {
          sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              active: active.value,
              borderShape: borderShape.value,
              borderShapeVariant: borderShapeVariant.value,
              borderShapeEffect: borderShapeEffect.value,
              borderShapeModifiers: borderShapeModifiers.value,
              borderColor: borderColor.value,
              borderColorVariant: borderColorVariant.value,
              borderColorEffect: borderColorEffect.value,
              borderColorModifiers: borderColorModifiers.value,
              title: title.value,
              titleVariant: titleVariant.value,
              titleEffect: titleEffect.value,
              titleModifiers: titleModifiers.value,
              theme: theme.value,
            } satisfies PreviewSnapshot),
          )
        } catch {
          canPersist = false
        }
      },
    )
  }

  return {
    active,
    borderShape,
    borderShapeVariant,
    borderShapeEffect,
    borderShapeModifiers,
    borderColor,
    borderColorVariant,
    borderColorEffect,
    borderColorModifiers,
    title,
    titleVariant,
    titleEffect,
    titleModifiers,
    theme,
    overrides,
  }
})
