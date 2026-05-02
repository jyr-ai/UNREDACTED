import 'dotenv/config'

function req(name, { optional = false } = {}) {
  const v = process.env[name]
  if (!v && !optional) throw new Error(`Missing required env var: ${name}`)
  return v || null
}

export const env = {
  r2: {
    accountId:       req('R2_ACCOUNT_ID'),
    accessKeyId:     req('R2_ACCESS_KEY_ID'),
    secretAccessKey: req('R2_SECRET_ACCESS_KEY'),
    bucket:          req('R2_BUCKET'),
    endpoint:        req('R2_ENDPOINT'),
  },
  supabase: {
    enabled:         (process.env.SUPABASE_ENABLED ?? 'true') !== 'false',
    url:             req('SUPABASE_URL',              { optional: true }),
    serviceRoleKey:  req('SUPABASE_SERVICE_ROLE_KEY', { optional: true }),
  },
  tmpDir: process.env.BULK_TMP_DIR || '/tmp/unredacted-bulk',
}

export function supabaseReady() {
  return env.supabase.enabled && env.supabase.url && env.supabase.serviceRoleKey
}
