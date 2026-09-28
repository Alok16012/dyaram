import { useState, useEffect } from 'react'
import { supabase, isConfigured, uploadPhoto } from '../lib/supabase'
import toast from 'react-hot-toast'
import { X, Upload, ExternalLink } from 'lucide-react'
import { BRAND } from '../lib/brand'

// Public website URL — used for the "View live page" link.
const SITE_URL = BRAND.website

// Starting content for the website "About" page. Numbers, milestones and
// team members are placeholders for the company to fill in before publishing.
const DEFAULT_ABOUT = {
  hero: {
    eyebrow: 'About Us',
    titleLine1: 'Your Journey to the Haramain,',
    titleLine2: 'In Trusted Hands.',
    subtitle: `${BRAND.legalName} helps pilgrims perform Hajj and Umrah with peace of mind — from visa and flights to hotels near the Haram, transport and guided Ziyarat.`,
  },
  stats: [
    { value: '—', label: 'Pilgrims Served' },
    { value: '—', label: 'Umrah Groups' },
    { value: '—', label: 'Years of Service' },
    { value: '—', label: 'Customer Rating' },
  ],
  mission: {
    eyebrow: 'Our Mission',
    title: 'Making Hajj & Umrah Easy, Safe and Spiritual',
    para1: 'We take care of every detail of your journey so you can focus completely on your ibadah — visas, air tickets, hotels in Makkah and Madinah, meals and transport.',
    para2: 'From first-time pilgrims to families and senior citizens, our team guides you before departure, during your stay and until you return home.',
    bullets: [
      'Umrah visa with insurance and return air tickets',
      'Hotels in Makkah & Madinah with daily meals',
      'Air-conditioned transport and guided Ziyarat',
      'Support before, during and after your journey',
    ],
    image: '',
    badgeValue: '',
    badgeLabel: 'Pilgrims served',
  },
  services: {
    eyebrow: 'What We Offer',
    title: 'Complete Hajj & Umrah Services',
    items: [
      { title: 'Umrah Packages', desc: 'Economy, premium and Ramadan packages', icon: '🕋' },
      { title: 'Hajj Packages', desc: 'Guided Hajj with experienced group leaders', icon: '🕌' },
      { title: 'Air Ticketing', desc: 'Group and individual fares to Jeddah & Madinah', icon: '✈️' },
      { title: 'Visa Assistance', desc: 'Umrah visa with insurance', icon: '📋' },
    ],
  },
  timeline: {
    eyebrow: 'Our Journey',
    title: 'Our Story So Far',
    milestones: [
      { year: '', event: 'Add your company milestones here' },
    ],
  },
  team: {
    eyebrow: 'Our Team',
    title: `The People Behind ${BRAND.name}`,
    subtitle: 'A dedicated team committed to serving the guests of Allah.',
    members: [
      { name: 'Team member', role: 'Director', image: '', bio: 'Add a short bio.' },
    ],
  },
}

// Deep clone so edits never mutate the default template.
const clone = (o) => JSON.parse(JSON.stringify(o))

// True when the error means the site_content table hasn't been created yet.
// PostgREST returns PGRST205 ("Could not find the table … in the schema
// cache"); Postgres DDL errors use 42P01 ("… does not exist").
const isMissingTable = (error) =>
  !!error && (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /could not find the table|does not exist/i.test(error.message || '')
  )

// ── Small building blocks ────────────────────────────────────────────
function Field({ label, value, onChange, textarea, placeholder }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5, color: 'var(--text-dim, #94a3b8)' }}>{label}</span>
      {textarea ? (
        <textarea className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 13, minHeight: 70, resize: 'vertical' }}
          value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      ) : (
        <input className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 13 }}
          value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
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

export default function WebsiteContent() {
  const [about, setAbout] = useState(clone(DEFAULT_ABOUT))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingIdx, setUploadingIdx] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (isConfigured) {
        const { data, error } = await supabase.from('site_content').select('value').eq('key', 'about').maybeSingle()
        if (cancelled) return
        // A missing table just falls back to defaults — the editor stays usable.
        if (!error && data?.value) {
          setAbout({ ...clone(DEFAULT_ABOUT), ...data.value })
        }
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  // Helpers to update nested state immutably.
  const setSec = (sec, patch) => setAbout(a => ({ ...a, [sec]: { ...a[sec], ...patch } }))
  const setArr = (sec, key, arr) => setAbout(a => ({ ...a, [sec]: { ...a[sec], [key]: arr } }))

  const save = async () => {
    if (!isConfigured) { toast.error('Supabase not connected'); return }
    setSaving(true)
    const { error } = await supabase.from('site_content')
      .upsert({ key: 'about', value: about, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    setSaving(false)
    if (error) {
      if (isMissingTable(error)) {
        toast.error('site_content table missing — run the SQL from supabase-schema.sql')
      } else {
        toast.error('Save failed: ' + (error.message || 'unknown'))
      }
      return
    }
    toast.success('Website content saved — live in a few seconds')
  }

  // Upload a photo for team member `i` and store its public URL.
  const uploadMemberPhoto = async (i, file) => {
    if (!file) return
    setUploadingIdx(i)
    try {
      const url = await uploadPhoto(file, 'team')
      const arr = [...about.team.members]
      arr[i] = { ...arr[i], image: url }
      setArr('team', 'members', arr)
      toast.success('Photo uploaded')
    } catch (e) {
      toast.error('Upload failed: ' + (e?.message || 'try a smaller image'))
    } finally {
      setUploadingIdx(null)
    }
  }

  const resetDefaults = () => {
    if (!confirm('Reset all About Us content to the original defaults? Unsaved edits will be lost.')) return
    setAbout(clone(DEFAULT_ABOUT))
    toast('Reset to defaults — click Save to publish')
  }

  if (loading) return <div className="loading-state"><div className="spinner" /></div>

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Website Content</h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim, #94a3b8)', marginTop: 4 }}>
            Edit the <strong>About Us</strong> page. Changes go live on the website within a few seconds of saving.
          </p>
        </div>
        {SITE_URL && <a className="btn btn-ghost" href={`${SITE_URL}/about`} target="_blank" rel="noreferrer" style={{ whiteSpace: 'nowrap' }}><ExternalLink size={15} /> View live page</a>}
      </div>

      {/* Hero */}
      <Section title="Hero (top banner)">
        <Field label="Eyebrow (small label)" value={about.hero.eyebrow} onChange={v => setSec('hero', { eyebrow: v })} />
        <Field label="Title — line 1" value={about.hero.titleLine1} onChange={v => setSec('hero', { titleLine1: v })} />
        <Field label="Title — line 2" value={about.hero.titleLine2} onChange={v => setSec('hero', { titleLine2: v })} />
        <Field label="Subtitle" textarea value={about.hero.subtitle} onChange={v => setSec('hero', { subtitle: v })} />
      </Section>

      {/* Stats */}
      <Section title="Stats bar (4 numbers)">
        {about.stats.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <input className="glass-input" style={{ flex: '0 0 130px', padding: '9px 12px', fontSize: 13 }} value={s.value}
              placeholder="Value" onChange={e => { const arr = [...about.stats]; arr[i] = { ...arr[i], value: e.target.value }; setAbout(a => ({ ...a, stats: arr })) }} />
            <input className="glass-input" style={{ flex: 1, padding: '9px 12px', fontSize: 13 }} value={s.label}
              placeholder="Label" onChange={e => { const arr = [...about.stats]; arr[i] = { ...arr[i], label: e.target.value }; setAbout(a => ({ ...a, stats: arr })) }} />
          </div>
        ))}
      </Section>

      {/* Mission */}
      <Section title="Mission">
        <Field label="Eyebrow" value={about.mission.eyebrow} onChange={v => setSec('mission', { eyebrow: v })} />
        <Field label="Title" value={about.mission.title} onChange={v => setSec('mission', { title: v })} />
        <Field label="Paragraph 1" textarea value={about.mission.para1} onChange={v => setSec('mission', { para1: v })} />
        <Field label="Paragraph 2" textarea value={about.mission.para2} onChange={v => setSec('mission', { para2: v })} />
        <span style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5, color: 'var(--text-dim, #94a3b8)' }}>Bullet points</span>
        {about.mission.bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="glass-input" style={{ flex: 1, padding: '9px 12px', fontSize: 13 }} value={b}
              onChange={e => { const arr = [...about.mission.bullets]; arr[i] = e.target.value; setArr('mission', 'bullets', arr) }} />
            <button className="btn btn-ghost" style={{ padding: '0 12px' }} onClick={() => setArr('mission', 'bullets', about.mission.bullets.filter((_, j) => j !== i))}><X size={14} /></button>
          </div>
        ))}
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setArr('mission', 'bullets', [...about.mission.bullets, 'New point'])}>+ Add bullet</button>
        <div style={{ marginTop: 14 }}>
          <Field label="Image URL" value={about.mission.image} onChange={v => setSec('mission', { image: v })} />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: '0 0 130px' }}><Field label="Badge value" value={about.mission.badgeValue} onChange={v => setSec('mission', { badgeValue: v })} /></div>
            <div style={{ flex: 1 }}><Field label="Badge label" value={about.mission.badgeLabel} onChange={v => setSec('mission', { badgeLabel: v })} /></div>
          </div>
        </div>
      </Section>

      {/* Services */}
      <Section title="Services grid">
        <Field label="Eyebrow" value={about.services.eyebrow} onChange={v => setSec('services', { eyebrow: v })} />
        <Field label="Title" value={about.services.title} onChange={v => setSec('services', { title: v })} />
        {about.services.items.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input className="glass-input" style={{ flex: '0 0 56px', padding: '9px', fontSize: 16, textAlign: 'center' }} value={it.icon}
              placeholder="🙂" onChange={e => { const arr = [...about.services.items]; arr[i] = { ...arr[i], icon: e.target.value }; setArr('services', 'items', arr) }} />
            <input className="glass-input" style={{ flex: '0 0 150px', padding: '9px 12px', fontSize: 13 }} value={it.title}
              placeholder="Title" onChange={e => { const arr = [...about.services.items]; arr[i] = { ...arr[i], title: e.target.value }; setArr('services', 'items', arr) }} />
            <input className="glass-input" style={{ flex: 1, padding: '9px 12px', fontSize: 13 }} value={it.desc}
              placeholder="Description" onChange={e => { const arr = [...about.services.items]; arr[i] = { ...arr[i], desc: e.target.value }; setArr('services', 'items', arr) }} />
            <button className="btn btn-ghost" style={{ padding: '0 12px' }} onClick={() => setArr('services', 'items', about.services.items.filter((_, j) => j !== i))}><X size={14} /></button>
          </div>
        ))}
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setArr('services', 'items', [...about.services.items, { title: 'New Service', desc: '', icon: '⭐' }])}>+ Add service</button>
      </Section>

      {/* Timeline */}
      <Section title="Journey / Timeline">
        <Field label="Eyebrow" value={about.timeline.eyebrow} onChange={v => setSec('timeline', { eyebrow: v })} />
        <Field label="Title" value={about.timeline.title} onChange={v => setSec('timeline', { title: v })} />
        {about.timeline.milestones.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="glass-input" style={{ flex: '0 0 80px', padding: '9px 12px', fontSize: 13 }} value={m.year}
              placeholder="Year" onChange={e => { const arr = [...about.timeline.milestones]; arr[i] = { ...arr[i], year: e.target.value }; setArr('timeline', 'milestones', arr) }} />
            <input className="glass-input" style={{ flex: 1, padding: '9px 12px', fontSize: 13 }} value={m.event}
              placeholder="What happened" onChange={e => { const arr = [...about.timeline.milestones]; arr[i] = { ...arr[i], event: e.target.value }; setArr('timeline', 'milestones', arr) }} />
            <button className="btn btn-ghost" style={{ padding: '0 12px' }} onClick={() => setArr('timeline', 'milestones', about.timeline.milestones.filter((_, j) => j !== i))}><X size={14} /></button>
          </div>
        ))}
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setArr('timeline', 'milestones', [...about.timeline.milestones, { year: '2025', event: '' }])}>+ Add milestone</button>
      </Section>

      {/* Team */}
      <Section title="Team">
        <Field label="Eyebrow" value={about.team.eyebrow} onChange={v => setSec('team', { eyebrow: v })} />
        <Field label="Title" value={about.team.title} onChange={v => setSec('team', { title: v })} />
        <Field label="Subtitle" textarea value={about.team.subtitle} onChange={v => setSec('team', { subtitle: v })} />
        {about.team.members.map((mem, i) => (
          <div key={i} style={{ border: '1px solid var(--border-glass, rgba(255,255,255,0.1))', borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim, #94a3b8)' }}>Member {i + 1}</span>
              <button className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => setArr('team', 'members', about.team.members.filter((_, j) => j !== i))}>Remove</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input className="glass-input" style={{ flex: 1, padding: '9px 12px', fontSize: 13 }} value={mem.name}
                placeholder="Name" onChange={e => { const arr = [...about.team.members]; arr[i] = { ...arr[i], name: e.target.value }; setArr('team', 'members', arr) }} />
              <input className="glass-input" style={{ flex: 1, padding: '9px 12px', fontSize: 13 }} value={mem.role}
                placeholder="Role" onChange={e => { const arr = [...about.team.members]; arr[i] = { ...arr[i], role: e.target.value }; setArr('team', 'members', arr) }} />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              {mem.image
                ? <img src={mem.image} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-glass, rgba(255,255,255,0.15))' }} />
                : <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👤</div>}
              <label className="btn btn-ghost" style={{ fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {uploadingIdx === i ? 'Uploading…' : <><Upload size={15} /> Upload photo</>}
                <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingIdx === i}
                  onChange={e => { uploadMemberPhoto(i, e.target.files?.[0]); e.target.value = '' }} />
              </label>
              <input className="glass-input" style={{ flex: 1, padding: '9px 12px', fontSize: 12.5 }} value={mem.image}
                placeholder="…or paste an image URL" onChange={e => { const arr = [...about.team.members]; arr[i] = { ...arr[i], image: e.target.value }; setArr('team', 'members', arr) }} />
            </div>
            <textarea className="glass-input" style={{ width: '100%', padding: '9px 12px', fontSize: 13, minHeight: 56, resize: 'vertical' }} value={mem.bio}
              placeholder="Short bio" onChange={e => { const arr = [...about.team.members]; arr[i] = { ...arr[i], bio: e.target.value }; setArr('team', 'members', arr) }} />
          </div>
        ))}
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setArr('team', 'members', [...about.team.members, { name: 'New Member', role: '', image: '', bio: '' }])}>+ Add member</button>
      </Section>

      {/* Sticky save bar */}
      <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg-body, #0f1117)', padding: '14px 0', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border-glass, rgba(255,255,255,0.08))' }}>
        <button className="btn btn-ghost" onClick={resetDefaults}>Reset to defaults</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save & Publish'}</button>
      </div>
    </div>
  )
}
