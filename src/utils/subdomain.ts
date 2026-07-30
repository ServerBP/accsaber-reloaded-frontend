export const isAdminSubdomain = window.location.hostname.startsWith('admin.')
export const isRankingSubdomain = window.location.hostname.startsWith('ranking.')
export const isCreativesSubdomain = window.location.hostname.startsWith('creatives.')
export const isCurationSubdomain = window.location.hostname.startsWith('curation.')
export const isStaffSubdomain =
  isAdminSubdomain || isRankingSubdomain || isCreativesSubdomain || isCurationSubdomain

export const isCurationSurface = isAdminSubdomain || isCurationSubdomain

export const currentRealm: 'ranking' | 'creatives' | 'curation' | null = isCreativesSubdomain
  ? 'creatives'
  : isRankingSubdomain
    ? 'ranking'
    : isCurationSubdomain
      ? 'curation'
      : null

function mainSiteBase(): string {
  const configured = import.meta.env.VITE_MAIN_SITE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return window.location.origin
}

export function mainSiteUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  if (!isStaffSubdomain) return suffix
  return `${mainSiteBase()}${suffix}`
}

export function playerProfileHref(userId: string | number): string {
  return mainSiteUrl(`/players/${userId}`)
}
