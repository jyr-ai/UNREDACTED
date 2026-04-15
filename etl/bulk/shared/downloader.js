import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import axios from 'axios'
import AdmZip from 'adm-zip'
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
  const res = await axios.get(url, { responseType: 'stream', timeout: 5 * 60_000 })
  await pipeline(res.data, fs.createWriteStream(zipPath))
  console.log(`  [downloaded] ${zipPath} (${fs.statSync(zipPath).size} bytes)`)
  return zipPath
}

export function extractZip(zipPath, innerName) {
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()
  const entry = entries.find(
    e => e.entryName === innerName || e.entryName.toLowerCase() === innerName.toLowerCase(),
  ) || entries[0]
  if (!entry) throw new Error(`No entries found in ${zipPath}`)

  const outPath = path.join(env.tmpDir, entry.entryName)
  zip.extractEntryTo(entry.entryName, env.tmpDir, false, true)
  console.log(`  [extracted] ${outPath}`)
  return outPath
}

export function fileChecksum(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}
