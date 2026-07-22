import { getEssenceBalance } from '@/api/items'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useEssenceStore = defineStore('essence', () => {
  const balance = ref<number | null>(null)
  const reserved = ref<number | null>(null)
  const loading = ref(false)
  const loaded = ref(false)

  async function fetchBalance(force = false): Promise<void> {
    if (!force && loaded.value) return
    loading.value = true
    try {
      const res = await getEssenceBalance()
      balance.value = res.balance
      reserved.value = res.reserved ?? 0
      loaded.value = true
    } catch {
    } finally {
      loading.value = false
    }
  }

  function setBalance(next: number): void {
    balance.value = next
    loaded.value = true
  }

  function reset(): void {
    balance.value = null
    reserved.value = null
    loaded.value = false
  }

  return { balance, reserved, loading, loaded, fetchBalance, setBalance, reset }
})
