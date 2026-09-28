import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

function AddNoteModal({ onSave, onClose }) {
  const [form, setForm] = useState({ action: '', details: '' })

  const submit = () => {
    if (!form.action.trim()) {
      toast.error('Action is required')
      return
    }
    onSave(form)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card animate-fade" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Note</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body-custom">
          <div className="form-field">
            <label>Action</label>
            <input className="glass-input" value={form.action} onChange={e => setForm({ ...form, action: e.target.value })} placeholder="e.g. Manual check" />
          </div>
          <div className="form-field">
            <label>Details</label>
            <textarea className="glass-input" rows={4} value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} placeholder="Describe what happened..." />
          </div>
        </div>

        <div className="modal-footer-custom">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Save Note</button>
        </div>
      </div>
    </div>
  )
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const fetchLogs = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      toast.error('Failed to load audit logs')
    } else {
      setLogs(data || [])
    }
    setLoading(false)
  }

  useEffect(() => { fetchLogs() }, [])

  const addLogEntry = async (formData) => {
    const { error } = await supabase.from('audit_logs').insert([{
      actor: 'Administrator',
      action: formData.action,
      details: formData.details,
    }])
    if (error) {
      toast.error('Failed to add note')
      return
    }
    toast.success('Note added')
    await fetchLogs()
  }

  const handleSave = async (formData) => {
    await addLogEntry(formData)
    setShowAdd(false)
  }

  const filteredLogs = logs.filter(l => {
    const q = search.toLowerCase()
    return (l.action || '').toLowerCase().includes(q) || (l.details || '').toLowerCase().includes(q)
  })

  return (
    <div className="audit-dashboard">
      <div className="audit-header">
        <div>
          <h1 className="text-gradient">Audit Logs</h1>
          <p className="text-muted">{logs.length} events recorded</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add Note
        </button>
      </div>

      <div className="filter-row">
        <input className="glass-input search-input" placeholder="Search by action or details..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <div className="glass-card audit-table-card">
          {filteredLogs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📜</div>
              <h3>No audit events found</h3>
              <p>Logins and system activity will appear here</p>
            </div>
          ) : (
            <div className="audit-table-scroll">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Details</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(log => (
                    <tr key={log.id}>
                      <td>{log.actor || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{log.action}</td>
                      <td className="details-cell">{log.details || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {log.created_at
                          ? new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <AddNoteModal onSave={handleSave} onClose={() => setShowAdd(false)} />
      )}

      <style jsx>{`
        .audit-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 24px;
          gap: 16px;
        }
        .audit-header h1 { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
        .audit-header .btn { white-space: nowrap; }

        .filter-row { margin-bottom: 20px; }
        .search-input { max-width: 320px; }

        .audit-table-card { padding: 0; overflow: hidden; }
        .audit-table-scroll { overflow-x: auto; }

        .details-cell {
          max-width: 320px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-dim);
        }

        .empty-state {
          padding: 48px 20px;
          text-align: center;
        }
        .empty-state-icon { font-size: 48px; margin-bottom: 12px; }
        .empty-state h3 { font-size: 18px; margin-bottom: 6px; }
        .empty-state p { color: var(--text-dim); }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .modal-content {
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-glass);
        }
        .modal-header h3 { font-size: 18px; font-weight: 800; }
        .modal-close-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #F1F5F9;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          font-size: 14px;
        }
        .modal-close-btn:hover {
          background: rgba(239,68,68,0.2);
          color: #ef4444;
        }
        .modal-body-custom {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .form-field label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .modal-footer-custom {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid var(--border-glass);
          background: #F8FAFC;
        }

        @media (max-width: 768px) {
          .audit-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .audit-header h1 { font-size: 22px; }
          .audit-header .btn { width: 100%; justify-content: center; }

          .modal-content { max-height: 95vh; }
          .modal-header { padding: 16px 20px; }
          .modal-header h3 { font-size: 16px; }
          .modal-body-custom { padding: 16px 20px; }
          .modal-footer-custom { padding: 12px 20px; }
        }
      `}</style>
    </div>
  )
}
