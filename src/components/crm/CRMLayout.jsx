import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useCRM } from '../../context/CRMContext'

const NAV_LINKS = [
  { path: '/crm',           label: 'Dashboard', icon: '📊' },
  { path: '/leads',     label: 'Leads',     icon: '👥', showCount: true },
  { path: '/bookings',  label: 'Bookings',  icon: '🎫' },
  { path: '/payments',  label: 'Payments',  icon: '💳', soon: true },
]

export default function CRMLayout({ children }) {
  const location = useLocation()
  const navigate  = useNavigate()
  const { leads }  = useCRM()

  const activeLeads = leads.filter(l => !['completed', 'lost'].includes(l.stage)).length

  return (
    <div className="crm-root">
      {/* ── TOP NAV ── */}
      <nav className="crm-nav">
        {/* Brand */}
        <Link to="/crm" className="crm-nav-brand">
          <div className="crm-nav-brand-icon">✈️</div>
          <div className="crm-nav-brand-text">
            <span className="crm-nav-brand-name">Shera Travels</span>
            <span className="crm-nav-brand-sub">CRM Dashboard</span>
          </div>
        </Link>

        {/* Links */}
        <div className="crm-nav-links">
          {NAV_LINKS.map(link => {
            const isActive = location.pathname === link.path ||
              (link.path !== '/crm' && location.pathname.startsWith(link.path))
            return (
              <button
                key={link.path}
                className={`crm-nav-link ${isActive ? 'active' : ''} ${link.soon ? 'crm-nav-soon' : ''}`}
                onClick={() => !link.soon && navigate(link.path)}
                style={link.soon ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                title={link.soon ? 'Coming soon' : ''}
              >
                <span className="crm-nav-link-icon">{link.icon}</span>
                {link.label}
                {link.showCount && activeLeads > 0 && (
                  <span className="crm-nav-badge">{activeLeads}</span>
                )}
                {link.soon && (
                  <span style={{ fontSize: 9, background: '#F1F5F9', color: '#94A3B8', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                    SOON
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Right side */}
        <div className="crm-nav-right">
          <Link to="/" className="crm-nav-itinerary-btn">
            📋 Itinerary Maker
          </Link>
          <div className="crm-nav-avatar" title="Admin">
            ST
          </div>
        </div>
      </nav>

      {/* ── PAGE CONTENT ── */}
      <main className="crm-page">
        <div className="crm-container">
          {children}
        </div>
      </main>
    </div>
  )
}
