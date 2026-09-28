import { useState, useEffect } from 'react'
import { supabase, isConfigured, uploadPhoto } from '../lib/supabase'
import toast from 'react-hot-toast'

const SITE_URL = 'https://sheratravelsxr.com'

const DIFFICULTIES = ['Easy', 'Moderate', 'Challenging']
const CATEGORIES = ['Kashmir', 'Mountains', 'Pilgrimage', 'Honeymoon', 'Budget']

const clone = (o) => JSON.parse(JSON.stringify(o))
const slugify = (s) =>
  (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const isMissingTable = (error) =>
  !!error && (error.code === 'PGRST205' || error.code === '42P01' ||
    /could not find the table|does not exist/i.test(error.message || ''))

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

// A brand-new package template.
const blankPackage = (nextId) => ({
  id: nextId,
  slug: '',
  title: '',
  location: '',
  state: 'Jammu & Kashmir',
  image: '',
  gallery: [],
  price: 9999,
  originalPrice: 0,
  duration: '',
  days: 6,
  nights: 5,
  groupSize: '2-15',
  minAge: 5,
  rating: 4.8,
  reviews: 50,
  dates: [],
  difficulty: 'Easy',
  badge: '',
  category: 'Kashmir',
  overview: '',
  highlights: [],
  itinerary: [],
  inclusions: [],
  exclusions: [],
  importantNotes: [],
  thingsToCarry: [],
})

// ── Building blocks ──────────────────────────────────────────────────
function Field({ label, value, onChange, textarea, type = 'text', placeholder, style }) {
  return (
    <label style={{ display: 'block', marginBottom: 12, ...style }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5, color: 'var(--text-dim, #94a3b8)' }}>{label}</span>
      {textarea ? (
        <textarea className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 13, minHeight: 70, resize: 'vertical' }}
          value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      ) : (
        <input className="glass-input" type={type} style={{ width: '100%', padding: '9px 12px', fontSize: 13 }}
          value={value ?? ''} placeholder={placeholder} onChange={e => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />
      )}
    </label>
  )
}

function Section({ title, children }) {
  return (
    <div className="glass-card" style={{ padding: 20, marginBottom: 18 }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>{title}</h3>
      {children}
    </div>
  )
}

// Editor for a simple string[] (highlights, inclusions, dates, etc.)
function ListEditor({ label, items, onChange, placeholder, addLabel }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-dim, #94a3b8)' }}>{label}</span>
      {(items || []).map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input className="glass-input" style={{ flex: 1, padding: '9px 12px', fontSize: 13 }} value={it}
            placeholder={placeholder} onChange={e => { const arr = [...items]; arr[i] = e.target.value; onChange(arr) }} />
          <button className="btn btn-ghost" style={{ padding: '0 12px' }} onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => onChange([...(items || []), ''])}>+ {addLabel || 'Add'}</button>
    </div>
  )
}

export default function WebsitePackages() {
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [draft, setDraft] = useState(null)       // package being edited
  const [editIndex, setEditIndex] = useState(-1) // -1 = new, >=0 = existing
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (isConfigured) {
        const { data, error } = await supabase.from('site_content').select('value').eq('key', 'packages').maybeSingle()
        if (!cancelled && !error && Array.isArray(data?.value)) setPackages(data.value)
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  // Persist the whole list back to Supabase.
  const saveAll = async (list) => {
    if (!isConfigured) { toast.error('Supabase not connected'); return false }
    setSaving(true)
    const { error } = await supabase.from('site_content')
      .upsert({ key: 'packages', value: list, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    setSaving(false)
    if (error) {
      toast.error(isMissingTable(error) ? 'site_content table missing — run supabase-schema.sql' : 'Save failed: ' + (error.message || 'unknown'))
      return false
    }
    setPackages(list)
    return true
  }

  const nextId = () => (packages.length ? Math.max(...packages.map(p => Number(p.id) || 0)) + 1 : 1)

  const startAdd = () => { setDraft(blankPackage(nextId())); setEditIndex(-1) }
  const startEdit = (i) => { setDraft(clone(packages[i])); setEditIndex(i) }
  const cancelEdit = () => { setDraft(null); setEditIndex(-1) }

  const removePackage = async (i) => {
    const p = packages[i]
    if (!confirm(`Delete package "${p.title}"? This removes it from the website. This cannot be undone.`)) return
    const ok = await saveAll(packages.filter((_, j) => j !== i))
    if (ok) toast.success('Package deleted')
  }

  const saveDraft = async () => {
    if (!draft.title.trim()) { toast.error('Title is required'); return }
    const d = clone(draft)
    if (!d.slug.trim()) d.slug = slugify(d.title)
    d.price = Number(d.price) || 0
    d.originalPrice = Number(d.originalPrice) || undefined
    if (!d.originalPrice) delete d.originalPrice
    if (!d.badge) delete d.badge
    const list = editIndex === -1 ? [...packages, d] : packages.map((p, i) => i === editIndex ? d : p)
    const ok = await saveAll(list)
    if (ok) { toast.success('Package saved — live on website in a few seconds'); cancelEdit() }
  }

  const setField = (key, value) => setDraft(d => ({ ...d, [key]: value }))

  const uploadImage = async (file, apply) => {
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadPhoto(file, 'packages')
      apply(url)
      toast.success('Image uploaded')
    } catch (e) {
      toast.error('Upload failed: ' + (e?.message || 'try a smaller image'))
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <div className="loading-state"><div className="spinner" /></div>

  // ── EDIT VIEW ──────────────────────────────────────────────────────
  if (draft) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost" onClick={cancelEdit}>← Back</button>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>{editIndex === -1 ? 'New Package' : 'Edit Package'}</h1>
          </div>
        </div>

        <Section title="Basics">
          <Field label="Title *" value={draft.title} onChange={v => setField('title', v)} placeholder="Magnificent Kashmir – 6 Days in Paradise" />
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="URL slug (auto if blank)" value={draft.slug} onChange={v => setField('slug', v)} placeholder="magnificent-kashmir" style={{ flex: 1 }} />
            <Field label="Category" value={draft.category} onChange={v => setField('category', v)} style={{ flex: '0 0 180px' }} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Location" value={draft.location} onChange={v => setField('location', v)} placeholder="Srinagar, Kashmir" style={{ flex: 1 }} />
            <Field label="State" value={draft.state} onChange={v => setField('state', v)} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ flex: 1, display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5, color: 'var(--text-dim, #94a3b8)' }}>Category (pick)</span>
              <select className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 13 }} value={draft.category} onChange={e => setField('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label style={{ flex: 1, display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5, color: 'var(--text-dim, #94a3b8)' }}>Difficulty</span>
              <select className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 13 }} value={draft.difficulty} onChange={e => setField('difficulty', e.target.value)}>
                {DIFFICULTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <Field label="Badge (optional)" value={draft.badge} onChange={v => setField('badge', v)} placeholder="Bestseller" style={{ flex: 1 }} />
          </div>
          <Field label="Overview" textarea value={draft.overview} onChange={v => setField('overview', v)} placeholder="Short description of the trip…" />
        </Section>

        <Section title="Pricing & Duration">
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Price (₹) *" type="number" value={draft.price} onChange={v => setField('price', v)} style={{ flex: 1 }} />
            <Field label="Original price (₹, optional)" type="number" value={draft.originalPrice} onChange={v => setField('originalPrice', v)} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Duration label" value={draft.duration} onChange={v => setField('duration', v)} placeholder="6D 5N" style={{ flex: 1 }} />
            <Field label="Days" type="number" value={draft.days} onChange={v => setField('days', v)} style={{ flex: '0 0 90px' }} />
            <Field label="Nights" type="number" value={draft.nights} onChange={v => setField('nights', v)} style={{ flex: '0 0 90px' }} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Group size" value={draft.groupSize} onChange={v => setField('groupSize', v)} placeholder="10-20" style={{ flex: 1 }} />
            <Field label="Min age" type="number" value={draft.minAge} onChange={v => setField('minAge', v)} style={{ flex: '0 0 90px' }} />
            <Field label="Rating" type="number" value={draft.rating} onChange={v => setField('rating', v)} style={{ flex: '0 0 90px' }} />
            <Field label="Reviews" type="number" value={draft.reviews} onChange={v => setField('reviews', v)} style={{ flex: '0 0 90px' }} />
          </div>
          <ListEditor label="Available batch dates" items={draft.dates} onChange={v => setField('dates', v)} placeholder="Jun 5" addLabel="Add date" />
        </Section>

        <Section title="Images">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            {draft.image
              ? <img src={draft.image} alt="" style={{ width: 70, height: 50, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 70, height: 50, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🖼️</div>}
            <label className="btn btn-ghost" style={{ fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {uploading ? 'Uploading…' : '📤 Upload cover'}
              <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
                onChange={e => { uploadImage(e.target.files?.[0], (url) => setField('image', url)); e.target.value = '' }} />
            </label>
            <input className="glass-input" style={{ flex: 1, padding: '9px 12px', fontSize: 12.5 }} value={draft.image}
              placeholder="…or paste cover image URL" onChange={e => setField('image', e.target.value)} />
          </div>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-dim, #94a3b8)' }}>Gallery images</span>
          {(draft.gallery || []).map((g, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              {g ? <img src={g} alt="" style={{ width: 44, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 44, height: 34, borderRadius: 6, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />}
              <input className="glass-input" style={{ flex: 1, padding: '9px 12px', fontSize: 12.5 }} value={g}
                onChange={e => { const arr = [...draft.gallery]; arr[i] = e.target.value; setField('gallery', arr) }} placeholder="Image URL" />
              <button className="btn btn-ghost" style={{ padding: '0 12px' }} onClick={() => setField('gallery', draft.gallery.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setField('gallery', [...(draft.gallery || []), ''])}>+ Add gallery URL</button>
            <label className="btn btn-ghost" style={{ fontSize: 12, cursor: 'pointer' }}>
              📤 Upload gallery image
              <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
                onChange={e => { uploadImage(e.target.files?.[0], (url) => setField('gallery', [...(draft.gallery || []), url])); e.target.value = '' }} />
            </label>
          </div>
        </Section>

        <Section title="Highlights & Inclusions">
          <ListEditor label="Trip highlights" items={draft.highlights} onChange={v => setField('highlights', v)} placeholder="Gulmarg gondola ride" addLabel="Add highlight" />
          <ListEditor label="What's included" items={draft.inclusions} onChange={v => setField('inclusions', v)} placeholder="5 nights accommodation" addLabel="Add inclusion" />
          <ListEditor label="What's NOT included" items={draft.exclusions} onChange={v => setField('exclusions', v)} placeholder="Airfare to Srinagar" addLabel="Add exclusion" />
        </Section>

        <Section title="Day-by-day Itinerary">
          {(draft.itinerary || []).map((day, i) => (
            <div key={i} style={{ border: '1px solid var(--border-glass, rgba(255,255,255,0.1))', borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim, #94a3b8)' }}>Day {day.day || i + 1}</span>
                <button className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => setField('itinerary', draft.itinerary.filter((_, j) => j !== i))}>Remove</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input className="glass-input" style={{ flex: '0 0 70px', padding: '9px', fontSize: 13 }} type="number" value={day.day}
                  placeholder="Day #" onChange={e => { const arr = [...draft.itinerary]; arr[i] = { ...arr[i], day: Number(e.target.value) }; setField('itinerary', arr) }} />
                <input className="glass-input" style={{ flex: 1, padding: '9px 12px', fontSize: 13 }} value={day.title}
                  placeholder="Day title" onChange={e => { const arr = [...draft.itinerary]; arr[i] = { ...arr[i], title: e.target.value }; setField('itinerary', arr) }} />
              </div>
              <textarea className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 13, minHeight: 60, resize: 'vertical', marginBottom: 8 }} value={day.description}
                placeholder="What happens this day…" onChange={e => { const arr = [...draft.itinerary]; arr[i] = { ...arr[i], description: e.target.value }; setField('itinerary', arr) }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="glass-input" style={{ flex: 1, padding: '9px 12px', fontSize: 13 }} value={day.meals}
                  placeholder="Meals (e.g. Breakfast, Dinner)" onChange={e => { const arr = [...draft.itinerary]; arr[i] = { ...arr[i], meals: e.target.value }; setField('itinerary', arr) }} />
                <input className="glass-input" style={{ flex: 1, padding: '9px 12px', fontSize: 13 }} value={day.accommodation}
                  placeholder="Accommodation" onChange={e => { const arr = [...draft.itinerary]; arr[i] = { ...arr[i], accommodation: e.target.value }; setField('itinerary', arr) }} />
              </div>
            </div>
          ))}
          <button className="btn btn-ghost" style={{ fontSize: 12 }}
            onClick={() => setField('itinerary', [...(draft.itinerary || []), { day: (draft.itinerary?.length || 0) + 1, title: '', description: '', meals: '', accommodation: '' }])}>+ Add day</button>
        </Section>

        <Section title="Extra info">
          <ListEditor label="Important notes" items={draft.importantNotes} onChange={v => setField('importantNotes', v)} placeholder="Kashmir is safe and welcoming…" addLabel="Add note" />
          <ListEditor label="Things to carry" items={draft.thingsToCarry} onChange={v => setField('thingsToCarry', v)} placeholder="Valid government ID (mandatory)" addLabel="Add item" />
        </Section>

        <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg-body, #0f1117)', padding: '14px 0', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border-glass, rgba(255,255,255,0.08))' }}>
          <button className="btn btn-ghost" onClick={cancelEdit}>Cancel</button>
          <button className="btn btn-primary" onClick={saveDraft} disabled={saving}>{saving ? 'Saving…' : 'Save Package'}</button>
        </div>
      </div>
    )
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────
  const filtered = packages.filter(p => {
    const q = search.toLowerCase()
    return !q || p.title?.toLowerCase().includes(q) || p.location?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
  })

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Website Packages</h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim, #94a3b8)', marginTop: 4 }}>
            Add, edit and delete the tour packages shown on the website. Changes go live within a few seconds.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn btn-ghost" href={`${SITE_URL}/trips`} target="_blank" rel="noreferrer" style={{ whiteSpace: 'nowrap' }}>↗ View live</a>
          <button className="btn btn-primary" onClick={startAdd}>+ New Package</button>
        </div>
      </div>

      <input className="glass-input" style={{ width: '100%', maxWidth: 340, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}
        placeholder="Search packages…" value={search} onChange={e => setSearch(e.target.value)} />

      {filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📦</div>
          <h3 style={{ marginBottom: 6 }}>{packages.length === 0 ? 'No packages yet' : 'No matches'}</h3>
          <p style={{ color: 'var(--text-dim, #94a3b8)' }}>{packages.length === 0 ? 'Click “New Package” to add your first tour.' : 'Try a different search.'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((p) => {
            const realIndex = packages.indexOf(p)
            return (
              <div key={p.id} className="glass-card" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14 }}>
                {p.image
                  ? <img src={p.image} alt="" style={{ width: 84, height: 60, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 84, height: 60, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🖼️</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>{p.title || 'Untitled'}</span>
                    {p.badge && <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '2px 8px', borderRadius: 20 }}>{p.badge}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim, #94a3b8)', marginTop: 3 }}>
                    {p.category} · {p.duration || `${p.days}D`} · {fmt(p.price)}{p.originalPrice ? ` (was ${fmt(p.originalPrice)})` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => startEdit(realIndex)}>✏️ Edit</button>
                  <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 13, color: '#ef4444' }} onClick={() => removePackage(realIndex)}>🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
