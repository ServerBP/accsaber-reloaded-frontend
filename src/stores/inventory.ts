import {
  equipItem as apiEquipItem,
  getUserEquippedItems,
  unequipItem as apiUnequipItem,
} from '@/api/items'
import type { EquippedItemsResponse, ItemTypeKey } from '@/types/api/items'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useInventoryStore = defineStore('inventory', () => {
  const equipped = ref<EquippedItemsResponse>({})
  const equippedUserId = ref<string | null>(null)
  const equippedLoaded = ref(false)
  const equippedLoading = ref(false)

  async function fetchEquipped(userId: string, force = false): Promise<void> {
    if (!force && equippedLoaded.value && equippedUserId.value === userId) return
    equippedLoading.value = true
    try {
      equipped.value = await getUserEquippedItems(userId)
      equippedUserId.value = userId
      equippedLoaded.value = true
    } catch {
      equipped.value = {}
    } finally {
      equippedLoading.value = false
    }
  }

  async function equip(linkId: string, currentUserId?: string | null, variantKey?: string): Promise<void> {
    await apiEquipItem(variantKey ? { linkId, variantKey } : { linkId })
    if (currentUserId) await fetchEquipped(currentUserId, true)
  }

  async function unequip(typeKey: ItemTypeKey, currentUserId?: string | null): Promise<void> {
    await apiUnequipItem(typeKey)
    if (currentUserId) await fetchEquipped(currentUserId, true)
  }

  function reset(): void {
    equipped.value = {}
    equippedUserId.value = null
    equippedLoaded.value = false
  }

  return {
    equipped,
    equippedUserId,
    equippedLoaded,
    equippedLoading,
    fetchEquipped,
    equip,
    unequip,
    reset,
  }
})
