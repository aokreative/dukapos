// Default store: in-memory Map persisted to a JSON file. Zero-config — good for
// a single small instance and for local development. For production/scale, set
// DATABASE_URL to use the Postgres store instead (store.pg.js).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, '..', 'data')
const FILE = resolve(DATA_DIR, 'tenants.json')

const tenants = new Map()

function persist() {
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(FILE, JSON.stringify([...tenants.values()], null, 2))
  } catch {
    /* best-effort */
  }
}

export function createMemoryStore() {
  return {
    kind: 'memory',
    async init() {
      try {
        if (existsSync(FILE)) {
          for (const t of JSON.parse(readFileSync(FILE, 'utf8'))) tenants.set(t.id, t)
        }
      } catch {
        /* start empty */
      }
    },
    async all() {
      return [...tenants.values()]
    },
    async getById(id) {
      return tenants.get(id) || null
    },
    async getByPhone(phone) {
      for (const t of tenants.values()) if (t.phone === phone) return t
      return null
    },
    async put(t) {
      tenants.set(t.id, t)
      persist()
      return t
    },
  }
}
