import express from 'express'

const router = express.Router()

// Verified channel IDs via YouTube RSS feed (youtube.com/feeds/videos.xml?channel_id=...)
const CHANNEL_IDS = {
  bloomberg:     'UCIALMKvObZNtJ6AmdCLP7Lg',
  abc:           'UCBi2mrWuNuyYy4gbM6fU18Q',
  cbs:           'UC8p1vwvWtl6T73JiExfWs1g',
  nbc:           'UCeY0bbntWzzVIaj2z3QigXg',
  fox:           'UCJg9wBPyKMNA5sRDnvzmkdg',
  yahoo_finance: 'UCEAZeUIeJs0IjQiqTCdVSIg',
}

let cached = null
let cachedAt = 0
const TTL_MS = 5 * 60 * 1000

// Tier 1: YouTube Data API v3 (requires YOUTUBE_API_KEY)
async function fetchLiveVideoIdApi(channelId, apiKey) {
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'id')
  url.searchParams.set('channelId', channelId)
  url.searchParams.set('eventType', 'live')
  url.searchParams.set('type', 'video')
  url.searchParams.set('maxResults', '1')
  url.searchParams.set('key', apiKey)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) })
  if (!res.ok) return null
  const data = await res.json()
  return data.items?.[0]?.id?.videoId ?? null
}

// Tier 2: scrape the channel's /live page to extract the current live videoId
async function scrapeCurrentLiveId(channelId) {
  const res = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
    signal: AbortSignal.timeout(8000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) return null
  const html = await res.text()

  // ytInitialPlayerResponse is embedded as JSON in the page; first videoId is the live stream
  const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)
  return match ? match[1] : null
}

// GET /api/live-streams
// Returns { source, channels: { [id]: { channelId, videoId } } }
// Tier 1 (YOUTUBE_API_KEY set): Data API v3 resolves current live videoId per channel.
// Tier 2 (no key): scrapes each channel's /live page to extract the current videoId.
// Client falls back to live_stream?channel= embed for any channel where videoId is null.
router.get('/', async (req, res) => {
  if (cached && Date.now() - cachedAt < TTL_MS) {
    return res.json(cached)
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  const entries = Object.entries(CHANNEL_IDS)

  const results = await Promise.allSettled(
    entries.map(([, channelId]) => {
      if (!channelId) return Promise.resolve(null)
      return apiKey
        ? fetchLiveVideoIdApi(channelId, apiKey)
        : scrapeCurrentLiveId(channelId)
    })
  )

  const channels = {}
  entries.forEach(([id, channelId], i) => {
    channels[id] = {
      channelId,
      videoId: results[i].status === 'fulfilled' ? results[i].value : null,
    }
  })

  const source = apiKey ? 'youtube-api' : 'scrape'
  cached = { source, channels }
  cachedAt = Date.now()

  res.json(cached)
})

export default router
