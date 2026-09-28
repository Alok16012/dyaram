import { useState } from 'react'
import toast from 'react-hot-toast'
import bcrypt from 'bcryptjs'
import { supabase, isDemo } from '../lib/supabase'
import { setSession } from '../lib/auth'
import { User, Lock, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react'
import BrandMark from '../components/BrandMark'
import { BRAND } from '../lib/brand'
import './Login.css'

export default function Login() {
  const [id, setId] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const username = id.trim()
      const { data: matches, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', username)
      if (error) throw error

      let user = matches?.[0] || null

      // First-run bootstrap: if no users exist yet, the default admin/admin123
      // credentials create the initial admin account automatically.
      if (!user) {
        const { data: anyUsers } = await supabase.from('app_users').select('id').limit(1)
        if ((!anyUsers || anyUsers.length === 0) && username === 'admin' && pass === 'admin123') {
          const password_hash = bcrypt.hashSync(pass, 10)
          const { data: created, error: createErr } = await supabase
            .from('app_users')
            .insert([{
              username: 'admin',
              password_hash,
              full_name: 'Administrator',
              role: 'Admin',
              is_admin: true,
              permissions: {},
              active: true,
            }])
            .select()
          if (createErr) throw createErr
          user = created?.[0] || null
        }
      }

      if (!user || !user.active || !bcrypt.compareSync(pass, user.password_hash)) {
        toast.error('Invalid ID or Password')
        setLoading(false)
        return
      }

      setSession(user)
      toast.success(`Welcome back, ${user.full_name || user.username}!`)
      supabase.from('audit_logs').insert([{ actor: user.full_name || user.username, action: 'Login', details: `Logged in as ${user.username}` }])
      // Full reload (not SPA nav) so all in-memory context — including the
      // per-user itinerary cache — resets cleanly for the new user.
      window.location.href = '/'
    } catch (err) {
      console.error('Login error:', err)
      toast.error('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const [showPass, setShowPass] = useState(false)
  const fillDemo = (u, pw) => { setId(u); setPass(pw) }

  return (
    <div className="auth">
      <aside className="auth-brand">
        <div className="auth-brand-top">
          <div className="auth-logo-badge"><BrandMark variant="full" size={64} /></div>
        </div>
        <div className="auth-brand-copy">
          <div className="auth-eyebrow">Hajj &amp; Umrah CRM</div>
          <h2>Serve every pilgrim,<br />from inquiry to Haramain.</h2>
          <p>Leads, bookings, Umrah itineraries, invoices and payments — one place for your whole team.</p>
          <ul>
            <li><CheckCircle2 size={18} /> Track pilgrims from first inquiry to departure</li>
            <li><CheckCircle2 size={18} /> Build Makkah &amp; Madinah itineraries in minutes</li>
            <li><CheckCircle2 size={18} /> GST invoices, payments and revenue reports</li>
          </ul>
        </div>
        <div className="auth-brand-foot">© {new Date().getFullYear()} {BRAND.legalName}. All rights reserved.</div>
        <svg className="auth-brand-art" viewBox="0 0 400 300" fill="none" aria-hidden="true">
          <path d="M-20 250C80 180 180 250 260 160S400 90 440 60" stroke="#fff" strokeOpacity=".18" strokeWidth="2" strokeDasharray="6 8" />
          <circle cx="330" cy="70" r="90" fill="#fff" fillOpacity=".06" />
          <circle cx="60" cy="260" r="120" fill="#fff" fillOpacity=".05" />
        </svg>
      </aside>

      <main className="auth-main">
        <form onSubmit={handleLogin} className="auth-card">
          <div className="auth-mobile-brand"><BrandMark variant="full" size={58} /></div>
          <h1>Welcome back</h1>
          <p className="auth-sub">Sign in to your account to continue.</p>

          <label className="auth-label" htmlFor="login-user">Username</label>
          <div className="auth-input">
            <User size={17} />
            <input id="login-user" type="text" placeholder="Enter your username" value={id} onChange={e => setId(e.target.value)} autoComplete="username" required />
          </div>

          <label className="auth-label" htmlFor="login-pass">Password</label>
          <div className="auth-input">
            <Lock size={17} />
            <input id="login-pass" type={showPass ? 'text' : 'password'} placeholder="Enter your password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" required />
            <button type="button" className="auth-eye" onClick={() => setShowPass(v => !v)} aria-label={showPass ? 'Hide password' : 'Show password'}>
              {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={loading}>
            {loading ? 'Signing in…' : <>Sign in <ArrowRight size={17} /></>}
          </button>

          {isDemo && (
            <div className="auth-demo">
              <div className="auth-demo-title">Demo accounts <span>click to fill</span></div>
              <button type="button" onClick={() => fillDemo('admin', 'admin123')}><strong>Admin</strong><span>admin / admin123</span></button>
              <button type="button" onClick={() => fillDemo('sales', 'demo123')}><strong>Sales</strong><span>sales / demo123</span></button>
              <button type="button" onClick={() => fillDemo('imran', 'demo123')}><strong>Operations</strong><span>imran / demo123</span></button>
            </div>
          )}
        </form>
      </main>
    </div>
  )
}
