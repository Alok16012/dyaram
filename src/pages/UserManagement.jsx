import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import bcrypt from 'bcryptjs'
import { supabase } from '../lib/supabase'
import { MODULES, getSession } from '../lib/auth'
import toast from 'react-hot-toast'

function UserModal({ user, onSave, onClose }) {
  const [form, setForm] = useState(user ? {
    ...user,
    password: '',
    permissions: user.permissions || {},
  } : {
    username: '', full_name: '', role: 'Staff', is_admin: false,
    password: '', active: true, permissions: {},
  })
  const [saving, setSaving] = useState(false)

  const togglePermission = (key) => {
    setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }))
  }

  const toggleAll = (value) => {
    const next = {}
    MODULES.forEach(m => { next[m.key] = value })
    setForm(f => ({ ...f, permissions: next }))
  }

  const handleSave = async () => {
    if (!form.username.trim() || !form.full_name.trim()) {
      toast.error('Username and Full Name are required')
      return
    }
    if (!user && !form.password) {
      toast.error('Password is required for a new user')
      return
    }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card animate-fade" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{user ? 'Edit User' : 'Add User'}</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body-custom">
          <div className="form-row">
            <div className="form-field">
              <label>Username</label>
              <input className="glass-input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="e.g. priya" disabled={!!user} />
            </div>
            <div className="form-field">
              <label>Full Name</label>
              <input className="glass-input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. Priya Sharma" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Role Label</label>
              <input className="glass-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="e.g. Sales Executive" />
            </div>
            <div className="form-field">
              <label>{user ? 'New Password (optional)' : 'Password'}</label>
              <input className="glass-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={user ? 'Leave blank to keep current' : '••••••••'} />
            </div>
          </div>

          <label className="admin-toggle-row">
            <input type="checkbox" checked={form.is_admin} onChange={e => setForm({ ...form, is_admin: e.target.checked })} />
            <div>
              <strong>Full Admin Access</strong>
              <p className="text-dim">Admins can access every module and manage other users.</p>
            </div>
          </label>

          {!form.is_admin && (
            <div className="permissions-block">
              <div className="permissions-head">
                <label>Module Access</label>
                <div className="permissions-actions">
                  <button type="button" className="link-btn" onClick={() => toggleAll(true)}>Select all</button>
                  <button type="button" className="link-btn" onClick={() => toggleAll(false)}>Clear all</button>
                </div>
              </div>
              <div className="permissions-grid">
                {MODULES.map(m => (
                  <label key={m.key} className="permission-chip">
                    <input type="checkbox" checked={!!form.permissions[m.key]} onChange={() => togglePermission(m.key)} />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="admin-toggle-row">
            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
            <div>
              <strong>Active</strong>
              <p className="text-dim">Inactive users cannot log in.</p>
            </div>
          </label>
        </div>

        <div className="modal-footer-custom">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save User'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const currentUser = getSession()

  const fetchUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Failed to load users')
      console.error(error)
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const handleSave = async (form) => {
    const payload = {
      username: form.username.trim(),
      full_name: form.full_name.trim(),
      role: form.role?.trim() || 'Staff',
      is_admin: !!form.is_admin,
      permissions: form.is_admin ? {} : form.permissions,
      active: !!form.active,
    }
    if (form.password) {
      payload.password_hash = bcrypt.hashSync(form.password, 10)
    }

    if (editingUser) {
      const { error } = await supabase.from('app_users').update(payload).eq('id', editingUser.id)
      if (error) {
        toast.error('Failed to update user')
        console.error(error)
        return
      }
      toast.success('User updated')
    } else {
      const { error } = await supabase.from('app_users').insert([payload])
      if (error) {
        toast.error(error.message?.includes('duplicate') ? 'Username already exists' : 'Failed to create user')
        console.error(error)
        return
      }
      toast.success('User created')
      supabase.from('audit_logs').insert([{
        actor: currentUser?.full_name || 'Administrator',
        action: 'Create User',
        details: `Created user account "${payload.username}"`,
      }])
    }
    await fetchUsers()
    setEditingUser(null)
    setShowAdd(false)
  }

  const toggleActive = async (u) => {
    if (u.id === currentUser?.id) {
      toast.error("You can't deactivate your own account")
      return
    }
    const { error } = await supabase.from('app_users').update({ active: !u.active }).eq('id', u.id)
    if (error) {
      toast.error('Failed to update user')
      console.error(error)
    } else {
      toast.success(u.active ? 'User deactivated' : 'User activated')
      await fetchUsers()
    }
  }

  const deleteUser = async (u) => {
    if (u.id === currentUser?.id) {
      toast.error("You can't delete your own account")
      return
    }
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return
    const { error } = await supabase.from('app_users').delete().eq('id', u.id)
    if (error) {
      toast.error('Failed to delete user')
      console.error(error)
    } else {
      toast.success('User deleted')
      await fetchUsers()
    }
  }

  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase()
    return u.username?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q)
  })

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <h1 className="text-gradient">Users & Roles</h1>
          <p className="text-muted">{users.length} accounts • control who can access what</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add User
        </button>
      </div>

      <div className="filter-row">
        <input
          className="glass-input search-input"
          placeholder="Search by username, name or role..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <div className="glass-card users-table-card">
          {filteredUsers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👤</div>
              <h3>No users found</h3>
              <p>Add your first team member to get started</p>
            </div>
          ) : (
            <div className="users-table-scroll">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Access</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => {
                    const permCount = Object.values(u.permissions || {}).filter(Boolean).length
                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, color: '#fff' }}>
                              {(u.full_name || u.username || '?').slice(0, 2).toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{u.full_name}</span>
                              <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>@{u.username}</span>
                            </div>
                          </div>
                        </td>
                        <td>{u.role || '—'}</td>
                        <td>
                          {u.is_admin ? (
                            <span className="access-badge admin">Full Admin</span>
                          ) : (
                            <span className="access-badge">{permCount} module{permCount === 1 ? '' : 's'}</span>
                          )}
                        </td>
                        <td>
                          <span className={`status-dot-pill ${u.active ? 'active' : 'inactive'}`}>
                            {u.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => setEditingUser(u)} title="Edit">✏️</button>
                            <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => toggleActive(u)} title={u.active ? 'Deactivate' : 'Activate'}>
                              {u.active ? '🚫' : '✅'}
                            </button>
                            <button className="btn btn-ghost" style={{ padding: 8, color: '#EF4444' }} onClick={() => deleteUser(u)} title="Delete">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(showAdd || editingUser) && (
        <UserModal
          user={editingUser}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditingUser(null) }}
        />
      )}

      <style jsx>{`
        .users-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 24px;
          gap: 16px;
        }
        .users-header h1 { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
        .users-header .btn { white-space: nowrap; }

        .filter-row { margin-bottom: 20px; }
        .search-input { max-width: 300px; }

        .users-table-card { padding: 0; overflow: hidden; }
        .users-table-scroll { overflow-x: auto; }

        .access-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          background: #EFF6FF;
          color: #2563EB;
          white-space: nowrap;
        }
        .access-badge.admin { background: #FEF3C7; color: #92400E; }

        .status-dot-pill {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          white-space: nowrap;
        }
        .status-dot-pill.active { background: #D1FAE5; color: #065F46; }
        .status-dot-pill.inactive { background: #FEE2E2; color: #991B1B; }

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
          max-width: 560px;
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
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
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

        .admin-toggle-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px;
          border-radius: 12px;
          background: #F8FAFC;
          border: 1px solid var(--border-glass);
          cursor: pointer;
        }
        .admin-toggle-row input { margin-top: 3px; width: 16px; height: 16px; flex-shrink: 0; }
        .admin-toggle-row strong { font-size: 13px; }
        .admin-toggle-row .text-dim { font-size: 11.5px; margin-top: 2px; }

        .permissions-block {
          border: 1px solid var(--border-glass);
          border-radius: 12px;
          padding: 14px;
        }
        .permissions-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .permissions-head label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .permissions-actions { display: flex; gap: 12px; }
        .link-btn {
          background: none;
          border: none;
          color: #2563EB;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          padding: 0;
        }
        .permissions-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .permission-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 8px;
          background: #F8FAFC;
          border: 1px solid var(--border-glass);
          font-size: 12.5px;
          cursor: pointer;
        }
        .permission-chip input { width: 14px; height: 14px; flex-shrink: 0; }

        @media (max-width: 768px) {
          .users-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .users-header h1 { font-size: 22px; }
          .users-header .btn { width: 100%; justify-content: center; }
          .search-input { max-width: 100%; }
          .form-row { grid-template-columns: 1fr; }
          .permissions-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  )
}
