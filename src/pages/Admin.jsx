import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import toast from 'react-hot-toast'
import { saveCredentials, clearCredentials, getStoredCredentials, isConfigured } from '../lib/supabase'
import { isAdmin } from '../lib/auth'

const DEFAULT_COMPANY = {
  name: 'Shera Travels',
  addr: 'Radio Colony, Srinagar, Lawaypora, Srinagar, Jammu and Kashmir 190017',
  email: 'sheratravels21@gmail.com',
  phone: '+91-9149406965, 9858966518',
  gst: '01KODPS7232P1ZE',
}

const DEFAULT_PRICE_TEMPLATES = [
  { pax_type: 'Adult', age_limit: 'Above 12 years', price: 17500 },
  { pax_type: 'Child', age_limit: '5–12 years', price: 8000 },
  { pax_type: 'Infant', age_limit: 'Below 5 years', price: 0 },
]

export default function Admin() {
  const [sbUrl, setSbUrl] = useState('')
  const [sbKey, setSbKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [connected, setConnected] = useState(isConfigured)

  const [company, setCompany] = useState(DEFAULT_COMPANY)
  const [templates, setTemplates] = useState(DEFAULT_PRICE_TEMPLATES)

  useEffect(() => {
    const creds = getStoredCredentials()
    setSbUrl(creds.url)
    setSbKey(creds.key)

    const savedCompany = localStorage.getItem('company_defaults')
    if (savedCompany) setCompany(JSON.parse(savedCompany))

    const savedTemplates = localStorage.getItem('price_templates')
    if (savedTemplates) setTemplates(JSON.parse(savedTemplates))
  }, [])

  const handleTestConnect = async () => {
    if (!sbUrl || !sbKey) { toast.error('URL aur API Key fill karo'); return }
    setTesting(true)
    try {
      const testClient = createClient(sbUrl.trim(), sbKey.trim())
      const { error } = await testClient.from('packages').select('id').limit(1)
      if (error && error.code !== 'PGRST116' && error.code !== '42P01') throw error
      saveCredentials(sbUrl.trim(), sbKey.trim())
      setConnected(true)
      toast.success('Connected! Reloading app...')
      setTimeout(() => { window.location.href = '/' }, 1500)
    } catch (e) {
      toast.error('Connection fail: ' + (e.message || 'Check credentials'))
      setConnected(false)
    }
    setTesting(false)
  }

  const handleDisconnect = () => {
    if (!window.confirm('Disconnect from Supabase?')) return
    clearCredentials()
    setConnected(false)
    setSbUrl('')
    setSbKey('')
    toast.success('Disconnected.')
    setTimeout(() => window.location.reload(), 1000)
  }

  const saveCompany = () => {
    localStorage.setItem('company_defaults', JSON.stringify(company))
    toast.success('Company info saved!')
  }

  const saveTemplates = () => {
    localStorage.setItem('price_templates', JSON.stringify(templates))
    toast.success('Price templates saved!')
  }

  return (
    <div className="page-content">
      <div className="dashboard-header">
        <div>
          <h1 className="text-gradient">Settings & Admin</h1>
          <p className="text-muted">Configure your workspace.</p>
        </div>
      </div>

      <div className="admin-sections-grid">
        {isAdmin() && (
          <section className="glass-card settings-card">
            <div className="settings-head">
              <div className="settings-icon">🔐</div>
              <div>
                <h3>Users & Roles</h3>
                <p className="text-dim">Create accounts and control per-module access.</p>
              </div>
            </div>
            <div className="settings-form">
              <p className="text-dim" style={{ fontSize: 13 }}>
                Add team members, assign a role label, and give each one exactly the modules they need — or full admin access.
              </p>
              <div className="form-actions">
                <Link to="/users" className="btn btn-primary">Manage Users</Link>
              </div>
            </div>
          </section>
        )}

        <section className="glass-card settings-card">
          <div className="settings-head">
            <div className="settings-icon">🗄️</div>
            <div>
              <h3>Supabase Database</h3>
              <p className="text-dim">Connect your cloud database.</p>
            </div>
            <div className={`status-pill ${connected ? 'saved' : 'unsaved'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          <div className="settings-form">
            <div className="form-field">
              <label>Project URL</label>
              <input 
                className="glass-input" 
                placeholder="https://xxx.supabase.co" 
                value={sbUrl}
                onChange={e => setSbUrl(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>API Key (Anon)</label>
              <input 
                className="glass-input" 
                type="password"
                placeholder="eyJhbGciOiJIUzI1Ni..." 
                value={sbKey}
                onChange={e => setSbKey(e.target.value)}
              />
            </div>
            <div className="form-actions">
              {connected ? (
                <button className="btn btn-ghost" onClick={handleDisconnect}>Disconnect</button>
              ) : (
                <button className="btn btn-primary" onClick={handleTestConnect} disabled={testing}>
                  {testing ? 'Testing...' : 'Connect Cloud'}
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="glass-card settings-card">
          <div className="settings-head">
            <div className="settings-icon">🏢</div>
            <div>
              <h3>Company Profile</h3>
              <p className="text-dim">Your brand details.</p>
            </div>
          </div>

          <div className="settings-form split">
            <div className="form-field">
              <label>Name</label>
              <input className="glass-input" value={company.name} onChange={e => setCompany({...company, name: e.target.value})} />
            </div>
            <div className="form-field">
              <label>Email</label>
              <input className="glass-input" value={company.email} onChange={e => setCompany({...company, email: e.target.value})} />
            </div>
            <div className="form-field full">
              <label>Address</label>
              <input className="glass-input" value={company.addr} onChange={e => setCompany({...company, addr: e.target.value})} />
            </div>
            <div className="form-field full">
              <label>GST Number</label>
              <input className="glass-input" value={company.gst || ''} onChange={e => setCompany({...company, gst: e.target.value})} placeholder="01KODPS7232P1ZE" />
            </div>
            <div className="form-actions full">
              <button className="btn btn-primary" onClick={saveCompany}>Save</button>
            </div>
          </div>
        </section>

        <section className="glass-card settings-card full-width">
          <div className="settings-head">
            <div className="settings-icon">💰</div>
            <div>
              <h3>Default Price Templates</h3>
              <p className="text-dim">Pre-fill package pricing.</p>
            </div>
          </div>
          
          <div className="settings-table-wrap">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Passenger Type</th>
                  <th>Age Limit</th>
                  <th>Base Price (₹)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t, i) => (
                  <tr key={i}>
                    <td><input className="table-inline-input" value={t.pax_type} onChange={e => {
                      const up = [...templates]; up[i].pax_type = e.target.value; setTemplates(up);
                    }} /></td>
                    <td><input className="table-inline-input" value={t.age_limit} onChange={e => {
                      const up = [...templates]; up[i].age_limit = e.target.value; setTemplates(up);
                    }} /></td>
                    <td><input className="table-inline-input" type="number" value={t.price} onChange={e => {
                      const up = [...templates]; up[i].price = Number(e.target.value); setTemplates(up);
                    }} /></td>
                    <td><button className="icon-btn" onClick={() => setTemplates(templates.filter((_, idx) => idx !== i))}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="form-actions-row">
              <button className="btn btn-ghost" onClick={() => setTemplates([...templates, {pax_type:'', age_limit:'', price:0}])}>+ Add</button>
              <button className="btn btn-primary" onClick={saveTemplates}>Save</button>
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .admin-sections-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        .full-width { grid-column: 1 / -1; }

        .settings-card { padding: 28px; }

        .settings-head {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
        }

        .settings-icon {
          width: 48px;
          height: 48px;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          font-size: 22px;
          flex-shrink: 0;
        }

        .settings-head h3 { font-size: 16px; margin-bottom: 2px; }
        .settings-head .text-dim { font-size: 12px; }

        .settings-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .settings-form.split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-field { display: flex; flex-direction: column; gap: 8px; }
        .form-field label { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
        .full { grid-column: 1 / -1; }

        .form-actions { margin-top: 8px; display: flex; gap: 12px; }
        .form-actions-row { 
          display: flex; 
          justify-content: space-between; 
          margin-top: 20px; 
          padding-top: 20px; 
          border-top: 1px solid var(--border-glass);
          gap: 12px;
        }

        .table-inline-input {
          background: none;
          border: none;
          color: var(--text-bright);
          font-family: inherit;
          font-size: 14px;
          width: 100%;
          outline: none;
          padding: 8px 0;
        }

        .status-pill {
          margin-left: auto;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.05);
        }
        .status-pill.saved { color: #10b981; }
        .status-pill.unsaved { color: #f59e0b; }

        @media (max-width: 1024px) {
          .admin-sections-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 768px) {
          .dashboard-header h1 { font-size: 22px; }
          .settings-card { padding: 20px; }
          .settings-head { flex-wrap: wrap; }
          .settings-icon { width: 42px; height: 42px; font-size: 20px; }
          .settings-form.split { grid-template-columns: 1fr; }
          .status-pill { margin-left: 0; width: 100%; text-align: center; padding: 6px; }
          .form-actions { flex-direction: column; }
          .form-actions .btn { width: 100%; justify-content: center; }
          .form-actions-row { flex-direction: column; }
          .form-actions-row .btn { width: 100%; justify-content: center; }
        }

        @media (max-width: 480px) {
          .settings-card { padding: 16px; }
          .settings-icon { width: 38px; height: 38px; font-size: 18px; }
          .settings-head h3 { font-size: 14px; }
        }
      `}</style>
    </div>
  )
}
