import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const STATIC_ROUTES = [
  { method: 'get', path: '/api/health', tag: 'System', summary: 'Backend health check' },
  { method: 'get', path: '/api/version', tag: 'System', summary: 'Backend version metadata' },
]

const ROUTE_SOURCES = [
  { mountPath: '/api/spending', fileUrl: new URL('./routes/spending.js', import.meta.url), tag: 'Spending' },
  { mountPath: '/api/policy', fileUrl: new URL('./routes/policy.js', import.meta.url), tag: 'Policy' },
  { mountPath: '/api/donors', fileUrl: new URL('./routes/donors.js', import.meta.url), tag: 'Donors' },
  { mountPath: '/api/agent', fileUrl: new URL('./routes/agent.js', import.meta.url), tag: 'Agent' },
  { mountPath: '/api/ai-agent', fileUrl: new URL('./routes/ai_agent.js', import.meta.url), tag: 'AI Agent' },
  { mountPath: '/api/feed', fileUrl: new URL('./routes/feed.js', import.meta.url), tag: 'Feed' },
  { mountPath: '/api/settings', fileUrl: new URL('./routes/settings.js', import.meta.url), tag: 'Settings' },
  { mountPath: '/api/corruption', fileUrl: new URL('./routes/corruption.js', import.meta.url), tag: 'Corruption' },
  { mountPath: '/api/companies', fileUrl: new URL('./routes/companies.js', import.meta.url), tag: 'Companies' },
  { mountPath: '/api/stockact', fileUrl: new URL('./routes/stockact.js', import.meta.url), tag: 'STOCK Act' },
  { mountPath: '/api/darkmoney', fileUrl: new URL('./routes/darkmoney.js', import.meta.url), tag: 'Dark Money' },
  { mountPath: '/api/conflict', fileUrl: new URL('./routes/conflict.js', import.meta.url), tag: 'Conflict' },
  { mountPath: '/api/campaign-watch', fileUrl: new URL('../backend/routes/campaignWatch.js', import.meta.url), tag: 'Campaign Watch' },
  { mountPath: '/api/gas/prices', fileUrl: new URL('../backend/routes/gasPrices.js', import.meta.url), tag: 'Gas Prices' },
  { mountPath: '/api/gas/stations', fileUrl: new URL('../backend/routes/gasStations.js', import.meta.url), tag: 'Gas Stations' },
  { mountPath: '/api/bootstrap', fileUrl: new URL('./routes/bootstrap.js', import.meta.url), tag: 'Bootstrap' },
  { mountPath: '/api/seed-health', fileUrl: new URL('./routes/seed-health.js', import.meta.url), tag: 'Seed Health' },
  {
    mountPath: '/api/cron',
    fileUrl: new URL('./routes/cron.js', import.meta.url),
    tag: 'Cron',
    extraRoutes: [
      { method: 'get', routePath: '/seed-corruption' },
      { method: 'get', routePath: '/seed-fec' },
      { method: 'get', routePath: '/seed-news-geo' },
      { method: 'get', routePath: '/seed-gas-prices' },
      { method: 'get', routePath: '/seed-elections' },
      { method: 'get', routePath: '/seed-dark-money' },
      { method: 'get', routePath: '/seed-spending' },
      { method: 'get', routePath: '/seed-stockact' },
    ],
  },
  { mountPath: '/api/fear-greed', fileUrl: new URL('../backend/routes/feargreed.js', import.meta.url), tag: 'Fear & Greed' },
  { mountPath: '/api/economic', fileUrl: new URL('../backend/routes/economic.js', import.meta.url), tag: 'Economic' },
]

const ROUTE_DECLARATION_RE = /router\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g

const QUERY_PARAMETER_OVERRIDES = {
  'GET /api/campaign-watch/money-flows': [
    { name: 'limit', in: 'query', description: 'Maximum number of flow edges to return.', schema: { type: 'integer', minimum: 1 } },
  ],
  'GET /api/campaign-watch/representatives': [
    { name: 'address', in: 'query', required: true, description: 'Street address, city/state, state abbreviation, or ZIP code.', schema: { type: 'string' } },
  ],
  'GET /api/campaign-watch/state/{stateCode}/legislation': [
    { name: 'limit', in: 'query', description: 'Maximum number of bills to return.', schema: { type: 'integer', minimum: 1, maximum: 50 } },
  ],
  'DELETE /api/campaign-watch/cache': [
    { name: 'prefix', in: 'query', description: 'Optional cache key prefix to clear.', schema: { type: 'string' } },
  ],
  'GET /api/gas/stations': [
    { name: 'lat', in: 'query', description: 'Latitude for a nearby search when ZIP is not provided.', schema: { type: 'number' } },
    { name: 'lng', in: 'query', description: 'Longitude for a nearby search when ZIP is not provided.', schema: { type: 'number' } },
    { name: 'zip', in: 'query', description: 'US ZIP code as an alternative to coordinates.', schema: { type: 'string' } },
    { name: 'radius', in: 'query', description: 'Search radius in miles.', schema: { type: 'integer', default: 10, maximum: 50 } },
    { name: 'fuel', in: 'query', description: 'Fuel type filter.', schema: { type: 'string', enum: ['regular', 'midgrade', 'premium', 'diesel'], default: 'regular' } },
    { name: 'sort', in: 'query', description: 'Sort order for results.', schema: { type: 'string', enum: ['distance', 'price'], default: 'distance' } },
  ],
  'GET /api/gas/stations/search': [
    { name: 'q', in: 'query', required: true, description: 'Location string to geocode before finding nearby stations.', schema: { type: 'string' } },
    { name: 'radius', in: 'query', description: 'Search radius in miles.', schema: { type: 'integer', default: 10, maximum: 50 } },
    { name: 'fuel', in: 'query', description: 'Fuel type filter.', schema: { type: 'string', enum: ['regular', 'midgrade', 'premium', 'diesel'], default: 'regular' } },
    { name: 'sort', in: 'query', description: 'Sort order for results.', schema: { type: 'string', enum: ['distance', 'price'], default: 'distance' } },
  ],
}

function discoverRoutes() {
  const routes = [...STATIC_ROUTES]

  for (const source of ROUTE_SOURCES) {
    const contents = readFileSync(fileURLToPath(source.fileUrl), 'utf8')
    const seen = new Set()

    for (const match of contents.matchAll(ROUTE_DECLARATION_RE)) {
      const method = match[1].toLowerCase()
      const routePath = match[3]
      const key = `${method}:${routePath}`
      if (seen.has(key)) continue
      seen.add(key)
      routes.push({
        method,
        path: joinPaths(source.mountPath, routePath),
        tag: source.tag,
      })
    }

    for (const extraRoute of source.extraRoutes || []) {
      const key = `${extraRoute.method}:${extraRoute.routePath}`
      if (seen.has(key)) continue
      seen.add(key)
      routes.push({
        method: extraRoute.method,
        path: joinPaths(source.mountPath, extraRoute.routePath),
        tag: source.tag,
      })
    }
  }

  return routes.sort((a, b) => {
    if (a.path === b.path) return a.method.localeCompare(b.method)
    return a.path.localeCompare(b.path)
  })
}

function joinPaths(basePath, routePath) {
  if (routePath === '/') return basePath
  return `${basePath}${routePath}`.replace(/\/+/g, '/')
}

function toOpenApiPath(pathname) {
  return pathname.replace(/:([A-Za-z0-9_]+)/g, '{$1}')
}

function pathParametersFor(pathname) {
  const matches = [...pathname.matchAll(/\{([A-Za-z0-9_]+)\}/g)]
  return matches.map(match => ({
    name: match[1],
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }))
}

function inferSummary(method, pathName) {
  const cleaned = pathName
    .replace(/^\/api\//, '')
    .replace(/\{([A-Za-z0-9_]+)\}/g, 'by $1')
    .replace(/\//g, ' ')
    .replace(/-/g, ' ')
    .trim()

  return `${method.toUpperCase()} ${cleaned}`.replace(/\s+/g, ' ')
}

function makeOperationId(method, pathName) {
  const normalized = pathName
    .replace(/^\/+|\/+$/g, '')
    .replace(/[{}]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return `${method.toLowerCase()}_${normalized || 'root'}`
}

function genericResponses() {
  return {
    200: { description: 'Successful response' },
    400: { description: 'Bad request' },
    500: { description: 'Internal server error' },
  }
}

function operationForRoute(route) {
  const openApiPath = toOpenApiPath(route.path)
  const overrideKey = `${route.method.toUpperCase()} ${openApiPath}`
  const parameters = [
    ...pathParametersFor(openApiPath),
    ...(QUERY_PARAMETER_OVERRIDES[overrideKey] || []),
  ]

  if (route.path.startsWith('/api/cron/')) {
    parameters.push({
      name: 'Authorization',
      in: 'header',
      required: false,
      description: 'Optional Bearer CRON_SECRET header. Required when CRON_SECRET is configured.',
      schema: { type: 'string' },
    })
  }

  const operation = {
    tags: [route.tag],
    summary: route.summary || inferSummary(route.method, openApiPath),
    description: 'Auto-generated from the Express route declarations mounted by server/app.js.',
    operationId: makeOperationId(route.method, openApiPath),
    parameters,
    responses: genericResponses(),
  }

  if (['post', 'put', 'patch'].includes(route.method)) {
    operation.requestBody = {
      required: false,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    }
  }

  if (route.path.startsWith('/api/ai-agent/')) {
    operation.responses[503] = { description: 'Upstream AI service unavailable' }
  }

  return operation
}

function buildPaths() {
  const paths = {}

  for (const route of discoverRoutes()) {
    const openApiPath = toOpenApiPath(route.path)
    paths[openApiPath] ||= {}
    paths[openApiPath][route.method] = operationForRoute(route)
  }

  return paths
}

export function buildOpenApiSpec({ serverUrl } = {}) {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'UNREDACTED Backend API',
      version: '1.0.0',
      description: 'Swagger view for the routes mounted by the active Express app in server/app.js.',
    },
    tags: Array.from(new Set(discoverRoutes().map(route => route.tag)))
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ name })),
    paths: buildPaths(),
  }

  if (serverUrl) {
    spec.servers = [{ url: serverUrl }]
  }

  return spec
}

export function renderSwaggerUi({ openApiUrl }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>UNREDACTED API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body {
        margin: 0;
        background: #f3f5f7;
      }

      .topbar {
        padding: 12px 20px;
        font: 600 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #213547;
        background: #ffffff;
        border-bottom: 1px solid #d9e0e8;
      }

      #swagger-ui {
        max-width: 1400px;
        margin: 0 auto;
      }
    </style>
  </head>
  <body>
    <div class="topbar">UNREDACTED backend docs</div>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(openApiUrl)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        docExpansion: 'list',
        displayRequestDuration: true,
        defaultModelsExpandDepth: 1,
        persistAuthorization: true,
        presets: [SwaggerUIBundle.presets.apis],
      })
    </script>
  </body>
</html>`
}
