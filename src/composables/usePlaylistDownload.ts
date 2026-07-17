import { useCategoryStore } from '@/stores/categories'
import { computed } from 'vue'

export function usePlaylistDownload() {
  const categoryStore = useCategoryStore()

  const playlistCategories = computed(() =>
    categoryStore.categories
      .filter((c) => c.code !== 'xp')
      .map((c) => ({
        code: c.code,
        name: c.name,
        accent: categoryStore.getAccent(c.code),
      })),
  )

  function downloadPlaylist(categoryCode: string) {
    const baseUrl = import.meta.env.VITE_API_BASE as string
    const a = document.createElement('a')
    a.href = `${baseUrl}/playlists?category=${categoryCode}`
    a.download = `accsaber-${categoryCode.replace('_', '-')}.json`
    a.click()
  }

  function downloadUnrankedPlaylist(categoryCode: string) {
    const baseUrl = import.meta.env.VITE_API_BASE as string
    const a = document.createElement('a')
    a.href = `${baseUrl}/playlists/unranked/${categoryCode}`
    a.download = `accsaber-queued-${categoryCode.replace('_', '-')}.json`
    a.click()
  }

  function downloadMissingPlaylist(userId: string, categoryCode: string) {
    const baseUrl = import.meta.env.VITE_API_BASE as string
    const a = document.createElement('a')
    a.href = `${baseUrl}/playlists/missing/${userId}/${categoryCode}`
    a.download = `accsaber-missing-${userId}-${categoryCode.replace('_', '-')}.bplist`
    a.click()
  }

  function downloadBatchPlaylist(batchId: string, batchName: string) {
    const baseUrl = import.meta.env.VITE_API_BASE as string
    const a = document.createElement('a')
    a.href = `${baseUrl}/playlists/batch/${batchId}`
    a.download = `accsaber-${batchName.toLowerCase().replace(/[\s_]+/g, '-')}.bplist`
    a.click()
  }

  return {
    playlistCategories,
    downloadPlaylist,
    downloadUnrankedPlaylist,
    downloadMissingPlaylist,
    downloadBatchPlaylist,
  }
}
