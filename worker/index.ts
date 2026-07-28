import { env } from 'cloudflare:workers'

export default {
  fetch(request) {
    const url = new URL(request.url)

    function createProxy(prefix: string, upstream: string | URL) {
      if (!url.pathname.startsWith(prefix)) return null
      const upstreamURL = new URL(url.pathname.slice(prefix.length), upstream)
      upstreamURL.search = url.search
      return fetch(upstreamURL, request)
    }

    return (
      createProxy('/v1/', new URL('v1/', env.API_PROXY_TARGET || 'https://api.accsaber.com')) ||
      createProxy('/proxy/beatsaver/', 'https://api.beatsaver.com') ||
      createProxy('/proxy/beatleader/', 'https://api.beatleader.com') ||
      createProxy('/proxy/scoresaber/', 'https://scoresaber.com') ||
      new Response('No matching route', { status: 404 })
    )
  },
} satisfies ExportedHandler
