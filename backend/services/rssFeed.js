import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent': 'UNREDACTED-Intelligence-Platform/1.0 (Government Accountability Research)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
  customFields: {
    item: [['media:content', 'media'], ['dc:date', 'dcDate']],
  },
})

// ── Google News RSS proxy helper ────────────────────────────────────────────
const gn = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`

// ── Feed Category Definitions ───────────────────────────────────────────────
// All URLs validated: 200 OK tested 2026-03. Google News fallbacks used where
// direct government feeds block server IPs (CBO 403, OMB redirect, etc.)

export const FEED_CATEGORIES = {

  SPENDING: {
    label: 'Gov Spending',
    color: '#4A7FFF',
    icon: '💰',
    sources: [
      { id: 'GAO',       label: 'GAO',         url: 'https://www.gao.gov/rss/reports.xml',              type: 'SPENDING' },
      { id: 'CBO',       label: 'CBO',         url: gn('site:cbo.gov budget scoring'),                  type: 'SPENDING' },
      { id: 'FEDREG',    label: 'FedReg',      url: 'https://www.federalregister.gov/documents/search.atom?conditions%5Btopics%5D%5B%5D=government-procurement&per_page=20&order=newest', type: 'RULE' },
      { id: 'TREASURY',  label: 'Treasury',    url: gn('site:treasury.gov fiscal spending'),            type: 'SPENDING' },
      { id: 'OMB',       label: 'OMB',         url: gn('OMB "office of management and budget" spending appropriation'), type: 'BUDGET' },
      { id: 'USASPEND',  label: 'USASpending', url: gn('federal contract award billion USASpending'),   type: 'CONTRACT' },
    ],
  },

  CORRUPTION: {
    label: 'Corruption',
    color: '#FF8000',
    icon: '⚠',
    sources: [
      { id: 'DOJ',       label: 'DOJ',         url: gn('site:justice.gov fraud corruption bribery indictment'), type: 'CORRUPTION' },
      { id: 'FBI',       label: 'FBI',         url: gn('site:fbi.gov fraud corruption white-collar crime'),     type: 'CORRUPTION' },
      { id: 'OIG',       label: 'IG Reports',  url: gn('inspector general fraud waste abuse report federal'),    type: 'AUDIT' },
      { id: 'CREW',      label: 'CREW',        url: 'https://www.citizensforethics.org/feed/',                  type: 'ETHICS' },
      { id: 'PROPUB',    label: 'ProPublica',  url: 'https://www.propublica.org/feeds/propublica/main',         type: 'CORRUPTION' },
      { id: 'POGO',      label: 'POGO',        url: gn('site:pogo.org government accountability corruption'),   type: 'WATCHDOG' },
      { id: 'CORRUPT_GN',label: 'Corruption News', url: gn('government corruption bribery kickback federal official'), type: 'CORRUPTION' },
    ],
  },

  SEC_FILING: {
    label: 'SEC & Filings',
    color: '#00AADD',
    icon: '📋',
    sources: [
      { id: 'SEC_PRESS', label: 'SEC Press',    url: 'https://www.sec.gov/news/pressreleases.rss',      type: 'SEC' },
      { id: 'SEC_EDGAR', label: 'SEC Form 4',   url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&dateb=&owner=include&count=20&search_text=&output=atom', type: 'INSIDER' },
      { id: 'SEC_ENF',   label: 'SEC Enforcement', url: gn('SEC enforcement action securities fraud charges'), type: 'SEC' },
      { id: 'SEC_INS',   label: 'SEC Insider',  url: gn('SEC insider trading investigation charges'),    type: 'INSIDER' },
      { id: 'SEC_HEDGE', label: 'Hedge Funds',  url: gn('SEC hedge fund 13F filing short selling investigation'), type: 'SEC' },
    ],
  },

  FEC_CAMPAIGN: {
    label: 'FEC & Campaign',
    color: '#9966CC',
    icon: '🗳',
    sources: [
      { id: 'FEC',       label: 'FEC',          url: gn('FEC campaign finance violation fine disclosure'), type: 'FEC' },
      { id: 'OPENSECRETS', label: 'OpenSecrets', url: gn('opensecrets campaign finance PAC donation congress'), type: 'CAMPAIGN' },
      { id: 'CAMFIN',    label: 'Campaign Finance', url: gn('campaign finance donation bundler super PAC election'), type: 'CAMPAIGN' },
      { id: 'LOBBYING',  label: 'Lobbying',     url: gn('lobbying disclosure federal register lobbyist spending'), type: 'LOBBYING' },
      { id: 'EARMARKS',  label: 'Earmarks',     url: gn('congressional earmark directed spending federal budget'), type: 'SPENDING' },
    ],
  },

  STOCK_ACT: {
    label: 'STOCK Act',
    color: '#FFB84D',
    icon: '📈',
    sources: [
      { id: 'STOCKACT',  label: 'STOCK Act',    url: gn('STOCK Act congress stock trade disclosure violation'), type: 'STOCK_ACT' },
      { id: 'CONGRTRADE',label: 'Congress Trades', url: gn('congress member senator representative stock trade disclosure'), type: 'STOCK_ACT' },
      { id: 'UNUSUALWH', label: 'Unusual Whales', url: gn('unusual whales congress trading political insider'), type: 'STOCK_ACT' },
      { id: 'CONFLINT',  label: 'Conflict of Interest', url: gn('congress conflict of interest stock committee oversight hearing'), type: 'ETHICS' },
    ],
  },

  POLITICIAN_SPEND: {
    label: 'Politician Spending',
    color: '#E63946',
    icon: '🏛',
    sources: [
      { id: 'REVDOOR',   label: 'Revolving Door', url: gn('revolving door federal official lobbyist government contractor'), type: 'ETHICS' },
      { id: 'CONTGRANT', label: 'Contracts',     url: gn('federal contract award sole source no-bid government spending billion'), type: 'CONTRACT' },
      { id: 'PORKSPEND', label: 'Waste/Fraud',   url: gn('federal spending waste fraud abuse government accountability misuse'), type: 'AUDIT' },
      { id: 'POLSPEND',  label: 'Pol. Finance',  url: gn('politician personal spending expense account federal funds misuse'), type: 'ETHICS' },
    ],
  },

  DARK_MONEY: {
    label: 'Dark Money',
    color: '#666666',
    icon: '🔎',
    sources: [
      { id: 'DARKMONEY', label: 'Dark Money',    url: gn('dark money 501c4 nonprofit political spending undisclosed'), type: 'DARK_MONEY' },
      { id: 'PACSPEND',  label: 'PAC Spending',  url: gn('super PAC political action committee spending election influence'), type: 'DARK_MONEY' },
      { id: 'TAXEXEMPT', label: '501(c) Groups', url: gn('501c4 tax exempt political spending IRS dark money disclosure'), type: 'DARK_MONEY' },
      { id: 'SHADOW_PAC',label: 'Shadow Money',  url: gn('shadow money political nonprofit undisclosed donor election'), type: 'DARK_MONEY' },
    ],
  },

  TRUMP_ADMIN: {
    label: 'Trump / DOGE',
    color: '#FF3B3B',
    icon: '🏛',
    sources: [
      { id: 'REUTERS_TOP',     label: 'Reuters',        url: gn('site:reuters.com politics government spending budget'),                                      type: 'NEWS'   },
      { id: 'REUTERS_BIZ',     label: 'Reuters Biz',    url: gn('site:reuters.com business economy federal budget'),                                          type: 'NEWS'   },
      { id: 'AP_TOP',          label: 'AP News',        url: gn('site:apnews.com politics government spending Trump'),                                        type: 'NEWS'   },
      { id: 'AP_POL',          label: 'AP Politics',    url: gn('site:apnews.com politics budget federal spending'),                                          type: 'POLICY' },
      { id: 'NYT_POL',         label: 'NYT Politics',   url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml',                                    type: 'POLICY' },
      { id: 'NYT_BIZ',         label: 'NYT Business',   url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',                                    type: 'BUDGET' },
      { id: 'WSJ_WORLD',       label: 'WSJ',            url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',                                                  type: 'NEWS'   },
      { id: 'WSJ_BIZ',         label: 'WSJ Business',   url: 'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml',                                              type: 'BUDGET' },
      { id: 'POLITICO',        label: 'Politico',       url: 'https://rss.politico.com/politics-news.xml',                                                   type: 'POLICY' },
      { id: 'GN_TRUMP_BUDGET', label: 'Trump Budget',   url: gn('Trump budget spending government federal'),                                                  type: 'BUDGET' },
      { id: 'GN_DOGE',         label: 'DOGE Cuts',      url: gn('DOGE government spending cuts efficiency Musk'),                                             type: 'BUDGET' },
      { id: 'GN_TRUMP_ADMIN',  label: 'Trump Admin',    url: gn('Trump administration federal spending budget plan'),                                         type: 'POLICY' },
    ],
  },
}

// ── Risk Keyword Scoring ────────────────────────────────────────────────────
const HIGH_RISK_KEYWORDS = [
  // Corruption / Crime
  'fraud', 'bribery', 'kickback', 'indictment', 'charged', 'arrested',
  'corruption', 'embezzlement', 'money laundering', 'racketeering',
  'whistleblower', 'criminal charges', 'felony', 'conspiracy',
  // Spending abuse
  'sole-source', 'no-bid', 'waste', 'abuse', 'misuse', 'improper payment',
  'overbilling', 'debarment', 'suspension', 'ig report', 'overrun',
  'unauthorized', 'misappropriation', 'audit finding', 'inspector general',
  // Financial
  'insider trading', 'SEC charges', 'SEC enforcement', 'market manipulation',
  'securities fraud', 'pump and dump', 'front running',
  // Political
  'STOCK Act violation', 'conflict of interest', 'dark money', 'illegal donation',
  'campaign finance violation', 'FEC fine', 'FEC penalty',
  // Scale
  'billion',
  // Budget / shutdown
  'government shutdown', 'debt ceiling', 'impoundment', 'rescission', 'sequester',
]

const MED_RISK_KEYWORDS = [
  'contract award', 'procurement', 'appropriation', 'override',
  'amendment', 'modification', 'oversight', 'deficiency', 'concern',
  'review', 'corrective action', 'compliance', 'penalty', 'fine',
  'sanction', 'unsatisfactory', 'cost overrun', 'delay', 'million',
  'sole source', 'investigation', 'inquiry', 'probe', 'allegation',
  'subpoena', 'grand jury', 'settlement', 'civil penalty',
  'stock trade', 'disclosure', 'PAC', 'lobbying', 'earmark',
  'revolving door', 'conflict', '501c4', 'dark money', 'undisclosed',
  // Trump admin / DOGE
  'Trump', 'DOGE', 'Musk', 'budget cut', 'federal spending',
  'continuing resolution', 'federal contract',
]

function scoreRisk(text) {
  const lower = (text || '').toLowerCase()
  if (HIGH_RISK_KEYWORDS.some(kw => lower.includes(kw))) return 'HIGH'
  if (MED_RISK_KEYWORDS.some(kw => lower.includes(kw))) return 'MED'
  return 'LOW'
}

// ── Time Formatting ─────────────────────────────────────────────────────────
function relativeTime(dateStr) {
  if (!dateStr) return 'recently'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'recently'
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Text Truncation ─────────────────────────────────────────────────────────
function truncate(str, maxLen = 120) {
  if (!str) return ''
  const clean = str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  return clean.length > maxLen ? clean.slice(0, maxLen - 1) + '…' : clean
}

// ── Per-category in-memory cache ────────────────────────────────────────────
const _categoryCache = {}
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getCategoryCache(category) {
  return _categoryCache[category] || null
}

function setCategoryCache(category, items) {
  _categoryCache[category] = { items, timestamp: Date.now() }
}

function isCacheFresh(category) {
  const c = _categoryCache[category]
  return c && Date.now() - c.timestamp < CACHE_TTL_MS
}

// ── Fetch Single Source ─────────────────────────────────────────────────────
async function fetchSource(source) {
  try {
    const feed = await parser.parseURL(source.url)
    return (feed.items || []).slice(0, 8).map(item => {
      const title = truncate(item.title || item['content:encoded'] || '', 120)
      const summary = truncate(item.contentSnippet || item.summary || item.content || '', 200)
      const pubDate = item.pubDate || item.isoDate || item.dcDate || item.updated
      const combinedText = `${title} ${summary}`
      return {
        type: source.type,
        category: source.category || 'GENERAL',
        source: source.label,
        sourceId: source.id,
        text: title,
        detail: summary || null,
        time: relativeTime(pubDate),
        pubDate: pubDate || null,
        risk: scoreRisk(combinedText),
        url: item.link || item.guid || null,
      }
    })
  } catch (err) {
    console.warn(`[rssFeed] Failed to fetch ${source.label}: ${err.message}`)
    return []
  }
}

// ── Fetch + Sort items for a category ──────────────────────────────────────
async function fetchCategory(categoryKey) {
  const categoryDef = FEED_CATEGORIES[categoryKey]
  if (!categoryDef) return []

  // Inject category key into each source
  const sources = categoryDef.sources.map(s => ({ ...s, category: categoryKey }))

  // Fetch in batches of 3 with delay to avoid rate limiting / timeouts
  const allItems = []
  for (let i = 0; i < sources.length; i += 3) {
    const batch = sources.slice(i, i + 3)
    const results = await Promise.allSettled(batch.map(fetchSource))
    for (const r of results) {
      if (r.status === 'fulfilled') allItems.push(...r.value)
    }
    if (i + 3 < sources.length) await new Promise(r => setTimeout(r, 300))
  }

  // Sort by pubDate descending (most recent first)
  allItems.sort((a, b) => (new Date(b.pubDate || 0)) - (new Date(a.pubDate || 0)))

  return allItems
}

// ── Public API: get one category ────────────────────────────────────────────
export async function getCategoryFeed(categoryKey, { limit = 15 } = {}) {
  const now = Date.now()

  if (isCacheFresh(categoryKey)) {
    const cached = getCategoryCache(categoryKey)
    return {
      items: cached.items.slice(0, limit),
      cached: true,
      fetchedAt: new Date(cached.timestamp).toISOString(),
      category: categoryKey,
      label: FEED_CATEGORIES[categoryKey]?.label || categoryKey,
    }
  }

  const items = await fetchCategory(categoryKey)
  setCategoryCache(categoryKey, items)

  return {
    items: items.slice(0, limit),
    cached: false,
    fetchedAt: new Date(now).toISOString(),
    category: categoryKey,
    label: FEED_CATEGORIES[categoryKey]?.label || categoryKey,
    sources: FEED_CATEGORIES[categoryKey]?.sources.map(s => s.label) || [],
  }
}

// ── Public API: get all categories aggregated ───────────────────────────────
export async function getAllFeeds({ limit = 30, category = null } = {}) {
  const now = Date.now()

  if (category && FEED_CATEGORIES[category]) {
    return getCategoryFeed(category, { limit })
  }

  // Fetch all categories that need refreshing
  const categoryKeys = Object.keys(FEED_CATEGORIES)
  const toFetch = categoryKeys.filter(k => !isCacheFresh(k))

  if (toFetch.length > 0) {
    // Fetch stale categories in parallel
    const fetchPromises = toFetch.map(async k => {
      const items = await fetchCategory(k)
      setCategoryCache(k, items)
    })
    await Promise.allSettled(fetchPromises)
  }

  // Aggregate all cached items
  const allItems = categoryKeys.flatMap(k => {
    const cached = getCategoryCache(k)
    return cached ? cached.items : []
  })

  // Sort globally by pubDate descending (most recent first)
  const sorted = allItems.sort((a, b) => (new Date(b.pubDate || 0)) - (new Date(a.pubDate || 0)))

  return {
    items: sorted.slice(0, limit),
    cached: toFetch.length === 0,
    fetchedAt: new Date(now).toISOString(),
    categories: categoryKeys.map(k => ({
      key: k,
      label: FEED_CATEGORIES[k].label,
      color: FEED_CATEGORIES[k].color,
      icon: FEED_CATEGORIES[k].icon,
    })),
    totalSources: categoryKeys.reduce((n, k) => n + (FEED_CATEGORIES[k].sources.length), 0),
  }
}

// ── Legacy: spending news (backward compat) ─────────────────────────────────
export async function getSpendingNews({ limit = 12 } = {}) {
  const result = await getCategoryFeed('SPENDING', { limit })
  return {
    items: result.items,
    cached: result.cached,
    fetchedAt: result.fetchedAt,
    sources: FEED_CATEGORIES.SPENDING.sources.map(s => s.label),
  }
}
