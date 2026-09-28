import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getSession, hasAccess, isAdmin, clearSession } from '../lib/auth'

export default function MainLayout({ children, headerActions }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const session = getSession()
  const admin = isAdmin()

  const handleLogout = () => {
    clearSession()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  const allNavGroups = [
    {
      label: 'Main',
      items: [
        { path: '/', label: 'Dashboard', icon: '📊' },
      ],
    },
    {
      label: 'Sales & CRM',
      items: [
        { path: '/leads', label: 'Leads', icon: '👥', module: 'leads' },
        { path: '/bookings', label: 'Bookings', icon: '📅', module: 'bookings' },
        { path: '/newsletter', label: 'Newsletter', icon: '✉️', module: 'leads' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { path: '/itinerary', label: 'Itinerary', icon: '📋', module: 'itinerary' },
        { path: '/invoices', label: 'Invoices', icon: '🧾', module: 'invoices' },
      ],
    },
    {
      label: 'Resources',
      items: [
        { path: '/hotels', label: 'Hotels', icon: '🏨', module: 'hotels' },
        { path: '/cabs', label: 'Cabs', icon: '🚕', module: 'cabs' },
        { path: '/photos', label: 'Photos', icon: '🖼️', module: 'photos' },
      ],
    },
    {
      label: 'Admin',
      items: [
        { path: '/income', label: 'Income', icon: '💰', module: 'income' },
        { path: '/expenses', label: 'Expenses', icon: '📉', module: 'expenses' },
        { path: '/audit-logs', label: 'Audit Logs', icon: '📜', module: 'audit_logs' },
        { path: '/admin', label: 'Settings', icon: '⚙️', module: 'admin' },
        ...(admin ? [{ path: '/users', label: 'Users & Roles', icon: '🔐' }] : []),
        ...(admin ? [{ path: '/website-content', label: 'Website Content', icon: '🌐' }] : []),
        ...(admin ? [{ path: '/website-packages', label: 'Website Packages', icon: '📦' }] : []),
      ],
    },
  ]

  const navGroups = allNavGroups
    .map(g => ({ ...g, items: g.items.filter(item => !item.module || hasAccess(item.module)) }))
    .filter(g => g.items.length > 0)

  const navItems = navGroups.flatMap(g => g.items)

  const mobileNavItems = navItems.filter(item =>
    ['/', '/itinerary', '/leads', '/bookings', '/admin'].includes(item.path)
  )

  return (
    <div className="layout-wrapper">
      {/* Mobile Overlay */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`} 
        onClick={() => setSidebarOpen(false)} 
      />

      {/* Sidebar */}
      <aside className={`sidebar-nav ${sidebarOpen ? 'open' : ''}`}>
        <NavLink to="/" className="brand" onClick={() => setSidebarOpen(false)}>
          <div className="brand-logo">ST</div>
          <span className="brand-name">Shera Travels</span>
        </NavLink>

        <nav className="nav-links">
          {navGroups.map(group => (
            <div key={group.label} className="nav-group">
              <div className="nav-group-label">{group.label}</div>
              {group.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="nav-footer">
          <button onClick={handleLogout} className="logout-btn">
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-viewport">
        <header className="main-header">
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
              ☰
            </button>
            <h2 className="text-gradient">
              {navItems.find(n => n.path === location.pathname)?.label || 'Dashboard'}
            </h2>
            <div className="search-bar">
              <span className="search-bar-icon">🔍</span>
              <input
                className="search-bar-input"
                type="text"
                placeholder="Search for anything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="header-right">
            {headerActions && <div className="header-actions-wrap">{headerActions}</div>}
            <div className="header-icons-group">
              <button className="header-icon-btn header-icon-help" title="Help">
                ❔
              </button>
              <button className="header-icon-btn header-icon-notif" title="Notifications">
                🔔
                <span className="badge">3</span>
              </button>
              <button className="header-icon-btn header-icon-settings" title="Settings" onClick={() => navigate('/admin')}>
                ⚙️
              </button>
            </div>
            <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '14px', fontWeight: '700' }}>{session?.full_name || session?.username || 'User'}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{session?.is_admin ? 'Super Admin' : (session?.role || 'Staff')}</p>
              </div>
              <div style={{
                width: 40, height: 40, background: 'var(--primary)',
                borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: '800', fontSize: '14px', color: '#fff'
              }}>{(session?.full_name || session?.username || 'U').slice(0, 2).toUpperCase()}</div>
            </div>
          </div>
        </header>

        <div className="page-workspace animate-fade">
          {children}
        </div>
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="bottom-nav">
        {mobileNavItems.map(item => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="bottom-nav-icon">{item.icon}</span>
              <span className="bottom-nav-label">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
