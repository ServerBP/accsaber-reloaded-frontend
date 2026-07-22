import { useAuthStore } from '@/stores/auth'
import { isStaffSubdomain, playerProfileHref } from '@/utils/subdomain'
import { useRouter } from 'vue-router'

export function useOwnProfileLink() {
  const authStore = useAuthStore()
  const router = useRouter()

  function goToOwnProfile(): void {
    const userId = authStore.userId
    if (!userId) return
    if (isStaffSubdomain) {
      window.location.assign(playerProfileHref(userId))
    } else {
      void router.push({ name: 'player-profile', params: { userId } })
    }
  }

  return { goToOwnProfile }
}
