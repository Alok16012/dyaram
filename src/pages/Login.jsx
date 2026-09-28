import { useState } from 'react'
import toast from 'react-hot-toast'
import bcrypt from 'bcryptjs'
import loginBg from '../assets/login-bg.png'
import { supabase } from '../lib/supabase'
import { setSession } from '../lib/auth'

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

  return (
    <div className="login-container">
      <div className="login-bg-overlay">
        <img src={loginBg} alt="Background" />
      </div>
      
      <div className="login-box glass">
        <div className="login-header">
          <div className="login-logo">✈️</div>
          <h1>Shera Travels</h1>
          <p>Itinerary Maker & CRM</p>
        </div>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="login-field">
            <label>Username</label>
            <input
              type="text"
              placeholder="Enter your username"
              value={id}
              onChange={e => setId(e.target.value)}
              required
            />
          </div>
          
          <div className="login-field">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={pass}
              onChange={e => setPass(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Authenticating...' : 'Login to Dashboard'}
          </button>
        </form>
        
        <div className="login-footer">
          <p>© 2026 Shera Travels. All rights reserved.</p>
        </div>
      </div>

      <style jsx>{`
        .login-container {
          height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: #000;
        }
        
        .login-bg-overlay {
          position: absolute;
          inset: 0;
          z-index: 0;
        }
        
        .login-bg-overlay img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.6;
          filter: blur(4px);
        }
        
        .login-box {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          padding: 40px;
          border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          text-align: center;
        }
        
        .login-logo {
          font-size: 48px;
          margin-bottom: 16px;
          animation: float 3s ease-in-out infinite;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        .login-header h1 {
          font-size: 32px;
          margin-bottom: 8px;
          background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .login-header p {
          color: #94a3b8;
          font-size: 14px;
          margin-bottom: 32px;
        }
        
        .login-form {
          text-align: left;
        }
        
        .login-field {
          margin-bottom: 20px;
        }
        
        .login-field label {
          display: block;
          color: #e2e8f0;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
          margin-left: 4px;
        }
        
        .login-field input {
          width: 100%;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          transition: all 0.3s ease;
        }
        
        .login-field input:focus {
          outline: none;
          background: rgba(255, 255, 255, 0.08);
          border-color: #6366f1;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }
        
        .btn-block {
          width: 100%;
          padding: 14px;
          font-size: 16px;
          margin-top: 12px;
        }
        
        .login-footer {
          margin-top: 32px;
          color: #64748b;
          font-size: 12px;
        }
      `}</style>
    </div>
  )
}
