import { env } from 'cloudflare:workers'

const CRAWLER_PATTERN =
  /discordbot|twitterbot|facebookexternalhit|slackbot|telegrambot|whatsapp|linkedinbot|redditbot|embedly|pinterest|vkshare|skypeuripreview|googlebot/i

const OG_PATH_PATTERN = /^\/(players|maps|campaigns)\/([^/]+)$/

const OG_CACHE_SECONDS = 300

function apiBase(): URL {
  return new URL('v1/', env.API_PROXY_TARGET || 'https://api.accsaber.com')
}

async function renderOpenGraph(url: URL, request: Request): Promise<Response | null> {
  const match = OG_PATH_PATTERN.exec(url.pathname)
  if (!match) return null
  if (!CRAWLER_PATTERN.test(request.headers.get('user-agent') || '')) return null

  const [, resource, id] = match
  const upstream = new URL(`og/${resource}/${id}`, apiBase())
  if (resource === 'maps') upstream.search = url.search

  const response = await fetch(upstream, {
    cf: { cacheTtl: OG_CACHE_SECONDS, cacheEverything: true },
  })
  if (!response.ok) return null

  const rendered = new Response(response.body, response)
  rendered.headers.set('cache-control', `public, max-age=${OG_CACHE_SECONDS}`)
  return rendered
}

export default {
  async fetch(request) {
    const url = new URL(request.url)

    function createProxy(prefix: string, upstream: string | URL) {
      if (!url.pathname.startsWith(prefix)) return null
      const upstreamURL = new URL(url.pathname.slice(prefix.length), upstream)
      upstreamURL.search = url.search
      return fetch(upstreamURL, request)
    }

    return (
      createProxy('/v1/', apiBase()) ||
      createProxy('/proxy/beatsaver/', 'https://api.beatsaver.com') ||
      createProxy('/proxy/beatleader/', 'https://api.beatleader.com') ||
      createProxy('/proxy/scoresaber/', 'https://scoresaber.com') ||
      (await renderOpenGraph(url, request)) ||
      new Response('No matching route', { status: 404 })
    )
  },
} satisfies ExportedHandler
