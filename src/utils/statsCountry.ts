export const STATS_COUNTRY_STORAGE_KEY = 'accsaber:stats:country'

export function loadStoredCountry(): string {
  try {
    return localStorage.getItem(STATS_COUNTRY_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function storeCountry(country: string): void {
  try {
    if (country) {
      localStorage.setItem(STATS_COUNTRY_STORAGE_KEY, country)
    } else {
      localStorage.removeItem(STATS_COUNTRY_STORAGE_KEY)
    }
  } catch {
  }
}
