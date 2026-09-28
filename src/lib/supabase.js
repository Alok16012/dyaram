import { createClient } from '@supabase/supabase-js'
import toast from 'react-hot-toast'
import { seedDemoData } from './demoData'

// Read from localStorage first (set via Admin page), fall back to env vars
const storedUrl = localStorage.getItem('sb_url')
const storedKey = localStorage.getItem('sb_key')

const supabaseUrl = (storedUrl && storedUrl.startsWith('https://')) ? storedUrl : import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = (storedKey && storedKey.length > 20) ? storedKey : import.meta.env.VITE_SUPABASE_ANON_KEY


// Check if real Supabase credentials are configured
const isLive = !!(
  supabaseUrl && 
  supabaseUrl.startsWith('https://') && 
  !supabaseUrl.includes('your_supabase_project_url_here') &&
  supabaseAnonKey && 
  supabaseAnonKey.length > 20 &&
  !supabaseAnonKey.includes('your_supabase_anon_key_here')
)

// Tables the mock client knows about. Each is persisted to localStorage
// under `mock_<table>`.
const MOCK_TABLES = [
  'packages', 'prices', 'days', 'day_photos', 'photo_library',
  'leads', 'lead_notes', 'bookings', 'payments', 'invoices',
  'hotels', 'cabs', 'income', 'expenses', 'audit_logs',
  'app_users', 'site_content',
]

// Embedded relations understood by `select('*, rel(...)')`.
// child: rows in `table` whose `fk` equals the parent's id.
// parent: the single row in `table` whose id equals the row's `fk`.
const RELATIONS = {
  days:     { day_photos: { kind: 'child',  table: 'day_photos', fk: 'day_id' } },
  bookings: { packages:   { kind: 'parent', table: 'packages',   fk: 'package_id' } },
}

// Primary key per table (defaults to `id`).
const PKEYS = { site_content: 'key' }

function createMockClient() {
  const load = (table) => {
    try { return JSON.parse(localStorage.getItem(`mock_${table}`) || '[]') } catch { return [] }
  }
  const store = Object.fromEntries(MOCK_TABLES.map(t => [t, load(t)]))

  const persist = (table) => {
    try {
      localStorage.setItem(`mock_${table}`, JSON.stringify(store[table] || []))
      return null
    } catch {
      return { message: 'Storage full. Try uploading smaller images.' }
    }
  }

  const withDefaults = (table, d) => {
    const now = new Date().toISOString()
    const row = { ...d }
    if (!PKEYS[table] && !row.id) row.id = crypto.randomUUID()
    if (table !== 'site_content' && !row.created_at) row.created_at = now
    if (table === 'bookings' && !row.booking_token) row.booking_token = crypto.randomUUID()
    return row
  }

  const embed = (table, rows, selectStr) => {
    const rels = RELATIONS[table]
    if (!rels || !selectStr) return rows
    return rows.map(r => {
      const out = { ...r }
      for (const [name, rel] of Object.entries(rels)) {
        if (!new RegExp(`\\b${name}\\s*\\(`).test(selectStr)) continue
        const target = store[rel.table] || []
        out[name] = rel.kind === 'child'
          ? target.filter(x => x[rel.fk] === r.id)
          : target.find(x => x.id === r[rel.fk]) || null
      }
      return out
    })
  }

  const compare = (a, b) => {
    if (a == null && b == null) return 0
    if (a == null) return 1
    if (b == null) return -1
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a).localeCompare(String(b))
  }

  const makeBuilder = (table) => {
    const filters = []
    let order = null
    let limitN = null
    let single = false
    let maybe = false
    let op = 'select'
    let data = null
    let selectStr = '*'
    let countMode = false
    let head = false
    let upsertKey = null

    const matches = (r) => filters.every(f => f(r))

    const execute = () => {
      if (!store[table]) store[table] = []
      const pk = PKEYS[table] || 'id'

      if (op === 'insert' || op === 'upsert') {
        const saved = []
        for (const d of data) {
          const key = op === 'upsert' ? (upsertKey || pk) : null
          const idx = key ? store[table].findIndex(r => r[key] === d[key]) : -1
          if (idx >= 0) {
            store[table][idx] = { ...store[table][idx], ...d }
            saved.push(store[table][idx])
          } else {
            const row = withDefaults(table, d)
            store[table].push(row)
            saved.push(row)
          }
        }
        const err = persist(table)
        if (err) return { data: null, error: err }
        return single || maybe ? { data: saved[0] || null, error: null } : { data: saved, error: null }
      }

      if (op === 'update') {
        store[table] = store[table].map(r => matches(r) ? { ...r, ...data } : r)
        const err = persist(table)
        if (err) return { data: null, error: err }
        const updated = store[table].filter(matches)
        return single || maybe ? { data: updated[0] || null, error: null } : { data: updated, error: null }
      }

      if (op === 'delete') {
        store[table] = store[table].filter(r => !matches(r))
        persist(table)
        return { data: null, error: null }
      }

      let rows = store[table].filter(matches)
      if (order) {
        const dir = order.ascending === false ? -1 : 1
        rows = [...rows].sort((a, b) => dir * compare(a[order.col], b[order.col]))
      }
      if (limitN != null) rows = rows.slice(0, limitN)
      const count = countMode ? rows.length : null
      if (head) return { data: null, count, error: null }
      rows = embed(table, rows, selectStr)
      if (single && !rows.length) return { data: null, count, error: { message: 'Row not found', code: 'PGRST116' } }
      if (single || maybe) return { data: rows[0] || null, count, error: null }
      return { data: rows, count, error: null }
    }

    const builder = {
      select: (cols, opts) => {
        if (typeof cols === 'string') selectStr = cols
        if (opts?.count) countMode = true
        if (opts?.head) head = true
        return builder
      },
      insert: (rows) => { op = 'insert'; data = Array.isArray(rows) ? rows : [rows]; return builder },
      upsert: (rows, opts) => { op = 'upsert'; data = Array.isArray(rows) ? rows : [rows]; upsertKey = opts?.onConflict || null; return builder },
      update: (d) => { op = 'update'; data = d; return builder },
      delete: () => { op = 'delete'; return builder },
      eq:     (col, val) => { filters.push(r => String(r[col]) === String(val)); return builder },
      neq:    (col, val) => { filters.push(r => String(r[col]) !== String(val)); return builder },
      in:     (col, vals) => { filters.push(r => vals.map(String).includes(String(r[col]))); return builder },
      gte:    (col, val) => { filters.push(r => r[col] >= val); return builder },
      lte:    (col, val) => { filters.push(r => r[col] <= val); return builder },
      order:  (col, opts = {}) => { order = { col, ascending: opts.ascending !== false }; return builder },
      limit:  (n) => { limitN = n; return builder },
      single: () => { single = true; return builder },
      maybeSingle: () => { maybe = true; return builder },
      then: (resolve, reject) => Promise.resolve().then(execute).then(resolve, reject),
      catch: (reject) => Promise.resolve().then(execute).catch(reject),
    }
    return builder
  }

  return {
    from: (table) => makeBuilder(table),
    storage: {
      from: () => ({
        upload: async () => ({ data: {}, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        remove: async () => ({ data: {}, error: null }),
      })
    }
  }
}

// Create client only if configured; otherwise run in demo mode on a
// localStorage-backed mock client, pre-seeded with sample data.
let supabase

if (isLive) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
} else {
  console.warn('⚠️ Supabase credentials not configured. Running in demo mode (localStorage).')
  seedDemoData()
  supabase = createMockClient()
}

// Demo mode: no Supabase credentials, data lives in localStorage and is
// pre-seeded with sample records so the whole CRM can be shown to a client.
const isDemo = !isLive

// `isConfigured` means "the data layer can read & write" — true in both
// live and demo mode, so every screen stays fully usable in the demo.
const isConfigured = true

export { supabase, isConfigured, isLive, isDemo }

// ── Credential helpers (used by Admin page) ────────────────────────────────
export function saveCredentials(url, key) {
  localStorage.setItem('sb_url', url.trim())
  localStorage.setItem('sb_key', key.trim())
}

export function clearCredentials() {
  localStorage.removeItem('sb_url')
  localStorage.removeItem('sb_key')
}

export function getStoredCredentials() {
  return {
    url: localStorage.getItem('sb_url') || '',
    key: localStorage.getItem('sb_key') || '',
  }
}

// ── Helper: Compress image to avoid localStorage quota issues in offline mode ──
function compressImage(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const MAX = 1024
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX }
        else { w = Math.round(w * MAX / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(objectUrl)
      resolve(canvas.toDataURL('image/jpeg', 0.75))
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      // Fallback to plain FileReader if image fails to load
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.readAsDataURL(file)
    }
    img.src = objectUrl
  })
}

// ── Helper: Resize image to a reasonable display size before upload, so
// thumbnails don't require downloading multi-MB camera originals ──────────
function resizeImage(file, maxDim = 1600, quality = 0.8) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim }
        else { w = Math.round(w * maxDim / h); h = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(objectUrl)
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', quality)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(file)
    }
    img.src = objectUrl
  })
}

// Warn the user only once per session that Storage isn't set up, so they don't
// get spammed on every photo while still learning why saves may be slow/failing.
let storageWarned = false
function warnStorageFallback(reason) {
  console.warn('Supabase storage unavailable, falling back to base64:', reason)
  if (!storageWarned) {
    storageWarned = true
    toast.error(
      "Storage bucket 'itinerary-photos' missing — photos are being embedded inline, which can make saves fail. Create a public bucket named 'itinerary-photos' in Supabase → Storage.",
      { duration: 8000 }
    )
  }
}

// ── Helper: Upload image file to Supabase Storage and return public URL ────
export async function uploadPhoto(file, folder = 'library') {
  if (!isLive) {
    return compressImage(file)
  }
  const resized = await resizeImage(file)
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`
  try {
    const { error } = await supabase.storage
      .from('itinerary-photos')
      .upload(fileName, resized, { upsert: false, contentType: 'image/jpeg' })
    if (error) {
      // Graceful fallback: bucket missing, RLS blocks upload, quota, etc.
      // Store a compressed base64 data URL so the app keeps working, but flag it —
      // base64 photos bloat every row save and can trigger "Failed to fetch".
      warnStorageFallback(error.message)
      return compressImage(file)
    }
    const { data: urlData } = supabase.storage.from('itinerary-photos').getPublicUrl(fileName)
    return urlData.publicUrl
  } catch (e) {
    // Network-level failure (e.g. "TypeError: Failed to fetch") also falls back
    // instead of hard-crashing the upload.
    warnStorageFallback(e?.message || 'network error')
    return compressImage(file)
  }
}

// ── Helper: Delete photo from storage ─────────────────────────────────────
export async function deletePhoto(url) {
  if (!isLive) return
  try {
    const path = url.split('/itinerary-photos/')[1]
    if (path) await supabase.storage.from('itinerary-photos').remove([path])
  } catch (e) {
    console.warn('Could not delete photo from storage:', e)
  }
}
