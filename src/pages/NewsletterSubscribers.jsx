import { useEffect, useState, useMemo } from 'react'
import { useCRM } from '../context/CRMContext'
import toast from 'react-hot-toast'

// A "newsletter subscriber" is any lead that came from the website newsletter
// box. New signups are tagged source = "Newsletter"; older ones only carry the
// "Newsletter signup" note, so we match either. We also require an email.
const isSubscriber = (l) =>
  !!l.email && (
    (l.source || '').toLowerCase() === 'newsletter' ||
    /newsletter/i.test(l.notes || '')
  )

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function NewsletterSubscribers() {
  const { leads, fetchLeads } = useCRM()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [showCompose, setShowCompose] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => { fetchLeads() }, [fetchLeads])

  // De-duplicate by lowercased email (someone may sign up twice), keep newest.
  const subscribers = useMemo(() => {
    const seen = new Map()
    for (const l of leads.filter(isSubscriber)) {
      const key = l.email.trim().toLowerCase()
      if (!seen.has(key)) seen.set(key, l)
    }
    return [...seen.values()]
  }, [leads])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return subscribers
    return subscribers.filter(s => s.email.toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q))
  }, [subscribers, search])

  const allVisibleSelected = filtered.length > 0 && filtered.every(s => selected.has(s.id))
  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) filtered.forEach(s => next.delete(s.id))
      else filtered.forEach(s => next.add(s.id))
      return next
    })
  }
  const toggleOne = (id) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  // The recipients for an action: selected ones, or everyone visible if none picked.
  const targets = selected.size ? filtered.filter(s => selected.has(s.id)) : filtered
  const emails = targets.map(s => s.email.trim())

  const copyEmails = async () => {
    if (!emails.length) return toast.error('No subscribers to copy')
    try {
      await navigator.clipboard.writeText(emails.join(', '))
      toast.success(`${emails.length} emails copied`)
    } catch {
      toast.error('Copy failed — select and copy manually')
    }
  }

  const exportCSV = () => {
    if (!targets.length) return toast.error('No subscribers to export')
    const rows = [['Name', 'Email', 'Signed up'], ...targets.map(s => [s.name || '', s.email, fmtDate(s.created_at)])]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${targets.length} subscribers`)
  }

  const sendBulk = () => {
    if (!emails.length) return toast.error('No recipients')
    if (!subject.trim()) return toast.error('Add a subject')
    // Open the default mail app with everyone BCC'd (keeps addresses private).
    const link = `mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = link
    setShowCompose(false)
    toast.success('Opening your email app…')
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      <div className="subs-header">
        <div>
          <h1 className="text-gradient">Newsletter Subscribers</h1>
          <p className="text-muted">{subscribers.length} subscribers from the website newsletter</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={copyEmails}>📋 Copy emails</button>
          <button className="btn btn-ghost" onClick={exportCSV}>⬇️ Export CSV</button>
          <button className="btn btn-primary" onClick={() => setShowCompose(true)}>✉️ Bulk Email</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="glass-input" style={{ maxWidth: 300, padding: '10px 14px', fontSize: 13 }}
          placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} />
        <span className="text-dim" style={{ fontSize: 13 }}>
          {selected.size ? `${selected.size} selected` : `${filtered.length} shown`}
          {' · '}actions apply to {selected.size ? 'selected' : 'all shown'}
        </span>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>📭</div>
            <h3 style={{ marginBottom: 6 }}>No subscribers yet</h3>
            <p className="text-dim">When visitors sign up on the website newsletter, they appear here.</p>
          </div>
        ) : (
          <table className="modern-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} /></th>
                <th>Name</th>
                <th>Email</th>
                <th>Signed up</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => toggleOne(s.id)}>
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{s.name || '—'}</td>
                  <td>{s.email}</td>
                  <td className="text-dim">{fmtDate(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCompose && (
        <div className="modal-overlay" onClick={() => setShowCompose(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="glass-card" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>Bulk email · {emails.length} recipients</h3>
              <button onClick={() => setShowCompose(false)} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5, color: 'var(--text-dim)' }}>Subject</span>
                <input className="glass-input" style={{ width: '100%', padding: '10px 12px', fontSize: 13 }} value={subject}
                  placeholder="🏔️ New Kashmir offers this month!" onChange={e => setSubject(e.target.value)} />
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5, color: 'var(--text-dim)' }}>Message</span>
                <textarea className="glass-input" style={{ width: '100%', padding: '10px 12px', fontSize: 13, minHeight: 160, resize: 'vertical' }} value={body}
                  placeholder="Write your newsletter message here…" onChange={e => setBody(e.target.value)} />
              </label>
              <p className="text-dim" style={{ fontSize: 12, lineHeight: 1.5 }}>
                Everyone is added as <strong>BCC</strong> (addresses stay private). This opens your default email app (Gmail/Outlook) with the message ready — just hit send.
                <br />For large lists (500+), use <strong>Export CSV</strong> and import into Mailchimp / Brevo instead.
              </p>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border-glass)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowCompose(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={sendBulk}>Open in email app →</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .subs-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .subs-header h1 { font-size: 26px; font-weight: 900; margin-bottom: 4px; }
        .modern-table th { text-align: left; padding: 12px 16px; font-size: 12px; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border-glass); }
        .modern-table td { padding: 12px 16px; font-size: 13.5px; border-bottom: 1px solid var(--border-glass); }
        .modern-table tbody tr:last-child td { border-bottom: none; }
        .modern-table tbody tr:hover { background: rgba(255,255,255,0.02); }
      `}</style>
    </div>
  )
}
