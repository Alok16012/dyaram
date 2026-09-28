import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { usePackage } from '../context/PackageContext'
import { useCRM } from '../context/CRMContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const PAGE_SIZE = 20

// Self-contained modal (inline styles + portal to <body>) so it renders
// centered regardless of any transformed ancestor on this page.
function TransferItineraryModal({ pkg, users, onTransfer, onClose }) {
  const [selected, setSelected] = useState(pkg.created_by || '')
  const currentOwner = users.find(u => u.id === pkg.created_by)
  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16,
  }
  const card = {
    background: 'var(--bg-card, #1e2030)', color: 'var(--text-bright, #fff)',
    borderRadius: 16, padding: 24, width: '100%', maxWidth: 420,
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border-glass, rgba(255,255,255,0.1))',
  }
  return createPortal(
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Transfer Itinerary</h3>
          <button className="btn btn-ghost" style={{ padding: 6 }} onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-dim, #94a3b8)', marginBottom: 16 }}>
          {pkg.title || 'Untitled'}
        </p>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Assign To</label>
        <select
          className="glass-input"
          style={{ width: '100%', padding: '10px 12px', fontSize: 13, marginBottom: 12 }}
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          <option value="">— Unassigned —</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
          ))}
        </select>
        <p style={{ fontSize: 12, color: 'var(--text-dim, #94a3b8)', marginBottom: 20 }}>
          Currently owned by: <strong>{currentOwner ? (currentOwner.full_name || currentOwner.username) : 'Unassigned'}</strong>
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onTransfer(selected || null)}>Transfer</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function Itinerary() {
  const navigate = useNavigate()
  const { packages, fetchPackages, createNewPackage, duplicatePackage, transferPackage, loading } = usePackage()
  const { leads, fetchLeads } = useCRM()
  const [clientMap, setClientMap] = useState({})
  const [page, setPage] = useState(1)
  const [filterDays, setFilterDays] = useState('')
  const [filterPlace, setFilterPlace] = useState('')
  const [users, setUsers] = useState([])
  const [transferTarget, setTransferTarget] = useState(null)

  useEffect(() => {
    fetchPackages()
    fetchLeads()
  }, [fetchPackages, fetchLeads])

  useEffect(() => {
    supabase.from('app_users').select('id, full_name, username, active').then(({ data }) => {
      setUsers((data || []).filter(u => u.active !== false))
    })
  }, [])

  useEffect(() => {
    // Initialize clientMap from packages
    const map = {}
    packages.forEach(p => {
      if (p.client_name) map[p.id] = p.client_name
    })
    setClientMap(map)
  }, [packages])

  // Same fallback the table cell uses, so the filter matches what's displayed.
  const placeOf = (p) => p.start_location || 'Kashmir'
  // Tidy the display label: single spaces, no space before punctuation.
  const cleanPlace = (s) => (s || 'Kashmir').replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim()
  // The match key ignores case AND punctuation/spacing, so "JAMMU", "Jammu ,"
  // and "Jammu," all collapse into one option. Filtering compares on this key.
  const normPlace = (s) => cleanPlace(s).toLowerCase().replace(/[^a-z0-9]+/g, '')

  const dayOptions = [...new Set(packages.map(p => p.days).filter(v => v != null && v !== ''))]
    .sort((a, b) => Number(a) - Number(b))

  // Dedupe places by normalized key; pick the best-formatted label to display
  // (prefer one that has a comma separator and isn't ALL CAPS).
  const scoreLabel = (l) => (l.includes(',') ? 2 : 0) + (l !== l.toUpperCase() ? 1 : 0)
  const placeMap = new Map()
  packages.forEach(p => {
    const key = normPlace(placeOf(p))
    const label = cleanPlace(placeOf(p))
    const existing = placeMap.get(key)
    if (!existing || scoreLabel(label) > scoreLabel(existing)) {
      placeMap.set(key, label)
    }
  })
  const placeOptions = [...placeMap.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const filteredPackages = packages.filter(p =>
    (!filterDays || String(p.days) === String(filterDays)) &&
    (!filterPlace || normPlace(placeOf(p)) === filterPlace)
  )

  const totalPages = Math.max(1, Math.ceil(filteredPackages.length / PAGE_SIZE))
  // Derive the clamped page directly during render (no effect needed) so it
  // self-corrects if the list shrinks below the current page, e.g. after a delete
  // or when a filter narrows the results.
  const currentPage = Math.min(page, totalPages)

  const pagedPackages = filteredPackages.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const rangeStart = filteredPackages.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredPackages.length)

  const handleClientChange = async (pkgId, clientName) => {
    setClientMap(prev => ({ ...prev, [pkgId]: clientName }))
    const { error } = await supabase
      .from('packages')
      .update({ client_name: clientName })
      .eq('id', pkgId)
    if (error) {
      toast.error('Failed to save client')
    } else {
      toast.success('Client assigned')
    }
  }

  const handleNew = async () => {
    const id = await createNewPackage()
    if (id) navigate(`/editor/${id}`)
  }

  const handleDuplicate = async (pkgId) => {
    const newId = await duplicatePackage(pkgId)
    if (newId) navigate(`/editor/${newId}`)
  }

  const handleTransfer = async (newOwnerId) => {
    const ok = await transferPackage(transferTarget.id, newOwnerId)
    if (ok) setTransferTarget(null)
  }

  const handleDelete = async (pkgId) => {
    if (!confirm('Delete this itinerary?')) return
    const { error } = await supabase.from('packages').delete().eq('id', pkgId)
    if (error) {
      toast.error('Failed to delete')
    } else {
      toast.success('Deleted')
      fetchPackages()
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-bright)', marginBottom: 4 }}>Itineraries</h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{packages.length} packages created</p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>
          <span>+</span> New Itinerary
        </button>
      </div>

      {!loading && packages.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="glass-input"
            style={{ padding: '8px 12px', fontSize: 13, minWidth: 150 }}
            value={filterDays}
            onChange={e => { setFilterDays(e.target.value); setPage(1) }}
          >
            <option value="">All Durations</option>
            {dayOptions.map(d => (
              <option key={d} value={d}>{d} Day{Number(d) > 1 ? 's' : ''}</option>
            ))}
          </select>
          <select
            className="glass-input"
            style={{ padding: '8px 12px', fontSize: 13, minWidth: 150 }}
            value={filterPlace}
            onChange={e => { setFilterPlace(e.target.value); setPage(1) }}
          >
            <option value="">All Places</option>
            {placeOptions.map(pl => (
              <option key={pl.key} value={pl.key}>{pl.label}</option>
            ))}
          </select>
          {(filterDays || filterPlace) && (
            <button
              className="btn btn-ghost"
              style={{ padding: '8px 14px', fontSize: 12.5 }}
              onClick={() => { setFilterDays(''); setFilterPlace(''); setPage(1) }}
            >
              ✕ Clear Filters
            </button>
          )}
          <span style={{ fontSize: 12.5, color: 'var(--text-dim)', marginLeft: 'auto' }}>
            {filteredPackages.length} of {packages.length} shown
          </span>
        </div>
      )}

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : packages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h2>No itineraries yet</h2>
          <p>Create your first travel itinerary</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleNew}>+ Create Itinerary</button>
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h2>No matching itineraries</h2>
          <p>Try adjusting or clearing the filters</p>
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => { setFilterDays(''); setFilterPlace(''); setPage(1) }}>✕ Clear Filters</button>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="modern-table itin-excel-table">
              <thead>
                <tr>
                  <th style={{ width: 60, textAlign: 'center' }}>Sr No</th>
                  <th>Package</th>
                  <th>Duration</th>
                  <th>Location</th>
                  <th>Client</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedPackages.map((pkg, idx) => (
                  <tr key={pkg.id}>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-dim)' }}>
                      {rangeStart + idx}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, color: '#fff' }}>
                          📋
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{pkg.title || 'Untitled'}</span>
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{pkg.nights}N / {pkg.days}D</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{pkg.start_location || 'Kashmir'}</td>
                    <td>
                      <select
                        className="glass-input"
                        style={{ padding: '6px 10px', fontSize: 12.5, minWidth: 150 }}
                        value={clientMap[pkg.id] || ''}
                        onChange={e => handleClientChange(pkg.id, e.target.value)}
                      >
                        <option value="">— No Client —</option>
                        {leads.map(lead => (
                          <option key={lead.id} value={lead.name}>{lead.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => navigate(`/editor/${pkg.id}`)} title="Edit">✏️</button>
                        <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => handleDuplicate(pkg.id)} title="Make a copy">📄</button>
                        <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => setTransferTarget(pkg)} title="Transfer">🔄</button>
                        <button className="btn btn-ghost" style={{ padding: 8, color: '#EF4444' }} onClick={() => handleDelete(pkg.id)} title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 20px', borderTop: '1px solid var(--border-glass)', flexWrap: 'wrap', gap: 12,
            }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
                Showing {rangeStart}–{rangeEnd} of {filteredPackages.length}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '6px 12px', fontSize: 12.5 }}
                  disabled={currentPage === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  ← Prev
                </button>
                <span style={{ fontSize: 12.5, color: 'var(--text-dim)', padding: '0 6px' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '6px 12px', fontSize: 12.5 }}
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {transferTarget && (
        <TransferItineraryModal
          pkg={transferTarget}
          users={users}
          onTransfer={handleTransfer}
          onClose={() => setTransferTarget(null)}
        />
      )}
    </div>
  )
}
