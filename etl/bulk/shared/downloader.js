import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import axios from 'axios'
import unzipper from 'unzipper'
import { env } from './env.js'

function ensureTmp() {
  fs.mkdirSync(env.tmpDir, { recursive: true })
}

export async function downloadZip(url, { cache = true } = {}) {
  ensureTmp()
  const name = path.basename(new URL(url).pathname)
  const zipPath = path.join(env.tmpDir, name)

  if (cache && fs.existsSync(zipPath)) {
    console.log(`  [cache] ${zipPath}`)
    return zipPath
  }

  console.log(`  [download] ${url}`)
  const res = await axios.get(url, { responseType: 'stream', timeout: 5 * 60_000, validateStatus: null })
  if (res.status === 404) {
    console.warn(`  [skip] 404 — ${url} not available for this cycle`)
    return null
  }
  if (res.status !== 200) throw new Error(`HTTP ${res.status} downloading ${url}`)
  await pipeline(res.data, fs.createWriteStream(zipPath))
  console.log(`  [downloaded] ${zipPath} (${fs.statSync(zipPath).size} bytes)`)
  return zipPath
}

/**
 * Download a direct (non-ZIP) file — CSV, TXT, etc.
 * Returns local file path, or null if the URL 404s (source not available this cycle).
 */
export async function downloadFile(url, { cache = true } = {}) {
  ensureTmp()
  const name = path.basename(new URL(url).pathname)
  const filePath = path.join(env.tmpDir, name)

  if (cache && fs.existsSync(filePath)) {
    console.log(`  [cache] ${filePath}`)
    return filePath
  }

  console.log(`  [download] ${url}`)
  const res = await axios.get(url, { responseType: 'stream', timeout: 10 * 60_000, validateStatus: null })
  if (res.status === 404) {
    console.warn(`  [skip] 404 — ${url} not available for this cycle`)
    return null
  }
  if (res.status !== 200) throw new Error(`HTTP ${res.status} downloading ${url}`)
  await pipeline(res.data, fs.createWriteStream(filePath))
  console.log(`  [downloaded] ${filePath} (${fs.statSync(filePath).size} bytes)`)
  return filePath
}

export async function extractZip(zipPath, innerName) {
  ensureTmp()
  let outPath = null
  await new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Parse())
      .on('entry', entry => {
        const matches = !innerName ||
          entry.path === innerName ||
          entry.path.toLowerCase() === innerName.toLowerCase()
        if (matches && !outPath) {
          outPath = path.join(env.tmpDir, path.basename(entry.path))
          entry.pipe(fs.createWriteStream(outPath))
            .on('finish', resolve)
            .on('error', reject)
        } else {
          entry.autodrain()
        }
      })
      .on('error', reject)
      .on('finish', () => { if (!outPath) reject(new Error(`No matching entry in ${zipPath}`)) })
  })
  console.log(`  [extracted] ${outPath}`)
  return outPath
}

export function fileChecksum(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}
