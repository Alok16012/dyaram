import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  House, Users, CalendarCheck, UserRound, Map as MapIcon, FileText, CreditCard,
  Hotel, Car, Images, Mail, Globe, Package, TrendingUp, Wallet,
  ScrollText, ShieldCheck, Settings, LogOut, Bell, Search, ChevronDown,
  Menu, User,
} from 'lucide-react'
import { getSession, hasAccess, isAdmin, clearSession } from '../lib/auth'
import { isDemo } from '../lib/supabase'
import { useCRM } from '../context/CRMContext'
import { useBooking } from '../context/BookingContext'
import BrandMark from './BrandMark'
import { BRAND } from '../lib/brand'

const COLLAPSE_KEY = 'sidebar_collapsed'

const timeAgo = (iso) => {
  if (!iso) return ''
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

// Close a popover when clicking anywhere outside `ref`.
function useClickOutside(ref, open, onClose) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, open, onClose])
}

function GlobalSearch() {
  const navigate = useNavigate()
  const { leads, fetchLeads } = useCRM()
  const { bookings, fetchBookings } = useBooking()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef(null)
  useClickOutside(wrapRef, open, () => setOpen(false))

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    const hit = (...vals) => vals.some(v => String(v || '').toLowerCase().includes(term))
    const b = bookings
      .filter(x => hit(x.customer_name, x.customer_phone, x.booking_ref, x.destination))
      .slice(0, 5)
      .map(x => ({ key: `b-${x.id}`, kind: 'Booking', title: `${x.customer_name} · ${x.booking_ref}`, sub: x.destination || '—', to: `/bookings/${x.id}` }))
    const l = leads
      .filter(x => hit(x.name, x.phone, x.email, x.destination))
      .slice(0, 5)
      .map(x => ({ key: `l-${x.id}`, kind: 'Lead', title: x.name, sub: [x.destination, x.phone].filter(Boolean).join(' · '), to: `/leads?q=${encodeURIComponent(x.name)}` }))
    return [...b, ...l]
  }, [q, leads, bookings])

  const go = (r) => {
    if (!r) return
    setOpen(false)
    setQ('')
    navigate(r.to)
  }

  return (
    <div className="search-bar" ref={wrapRef}>
      <span className="search-bar-icon"><Search size={17} /></span>
      <input
        className="search-bar-input"
        type="text"
        placeholder="Search by name, phone, booking ID, destination..."
        value={q}
        onFocus={() => { fetchLeads(); fetchBookings(); setOpen(true) }}
        onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
          if (e.key === 'Enter') go(results[active])
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && q.trim() && (
        <div className="search-results">
          {results.length === 0 ? (
            <div className="search-empty">No matches for “{q}”</div>
          ) : results.map((r, i) => (
            <button key={r.key} className={`search-result ${i === active ? 'active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => go(r)}>
              <div>
                <div className="search-result-title">{r.title}</div>
                <div className="search-result-sub">{r.sub}</div>
              </div>
              <span className="search-result-kind">{r.kind}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Notifications() {
  const navigate = useNavigate()
  const { leads } = useCRM()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, open, () => setOpen(false))
  const fresh = leads.filter(l => l.stage === 'new_inquiry').slice(0, 6)

  return (
    <div className="user-menu" ref={ref}>
      <button className="header-icon-btn" title="Notifications" onClick={() => setOpen(o => !o)}>
        <Bell size={21} strokeWidth={1.8} />
        {fresh.length > 0 && <span className="badge">{fresh.length}</span>}
      </button>
      {open && (
        <div className="dropdown notif-list">
          <div className="dropdown-head">
            <div className="dropdown-title">Notifications</div>
            <div className="dropdown-sub">{fresh.length ? `${fresh.length} new inquiries waiting` : 'You’re all caught up'}</div>
          </div>
          {fresh.map(l => (
            <button key={l.id} className="dropdown-item notif-item" onClick={() => { setOpen(false); navigate(`/leads?q=${encodeURIComponent(l.name)}`) }}>
              <span className="notif-dot" />
              <span>
                <div style={{ color: 'var(--text-bright)', fontWeight: 500 }}>New inquiry from {l.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.destination || 'Destination TBD'} · {timeAgo(l.created_at)}</div>
              </span>
            </button>
          ))}
          <div className="dropdown-sep" />
          <button className="dropdown-item" onClick={() => { setOpen(false); navigate('/leads') }}>View all leads</button>
        </div>
      )}
    </div>
  )
}

function UserMenu({ session, onLogout }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, open, () => setOpen(false))
  const name = session?.full_name || session?.username || 'User'
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-menu-btn" onClick={() => setOpen(o => !o)}>
        <div className="user-avatar">{initials}</div>
        <div className="user-meta">
          <div className="user-name">{name}</div>
          <div className="user-role">{session?.is_admin ? 'Admin' : (session?.role || 'Staff')}</div>
        </div>
        <ChevronDown size={16} color="#64748B" className="user-meta" />
      </button>
      {open && (
        <div className="dropdown">
          <div className="dropdown-head">
            <div className="dropdown-title">{name}</div>
            <div className="dropdown-sub">@{session?.username}</div>
          </div>
          {hasAccess('admin') && (
            <button className="dropdown-item" onClick={() => { setOpen(false); navigate('/admin') }}>
              <Settings size={16} /> Settings
            </button>
          )}
          {isAdmin() && (
            <button className="dropdown-item" onClick={() => { setOpen(false); navigate('/users') }}>
              <User size={16} /> Users & Roles
            </button>
          )}
          <div className="dropdown-sep" />
          <button className="dropdown-item danger" onClick={onLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      )}
    </div>
  )
}

export default function MainLayout({ children, headerActions }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
  })
  const session = getSession()
  const admin = isAdmin()

  const toggleCollapsed = () => {
    setCollapsed(c => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1') } catch { /* ignore */ }
      return !c
    })
  }

  const handleLogout = () => {
    clearSession()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  const I = (icon) => { const Icon = icon; return <Icon size={19} strokeWidth={1.8} /> }

  const allNavGroups = [
    { label: 'Main', items: [
      { path: '/', label: 'Dashboard', icon: I(House) },
    ] },
    { label: 'Sales & CRM', items: [
      { path: '/leads', label: 'Leads', icon: I(Users), module: 'leads' },
      { path: '/bookings', label: 'Bookings', icon: I(CalendarCheck), module: 'bookings' },
      { path: '/customers', label: 'Customers', icon: I(UserRound), module: 'leads' },
    ] },
    { label: 'Operations', items: [
      { path: '/itinerary', label: 'Itineraries', icon: I(MapIcon), module: 'itinerary' },
      { path: '/invoices', label: 'Invoices', icon: I(FileText), module: 'invoices' },
      { path: '/payments', label: 'Payments', icon: I(CreditCard), module: 'bookings' },
    ] },
    { label: 'Resources', items: [
      { path: '/hotels', label: 'Hotels', icon: I(Hotel), module: 'hotels' },
      { path: '/cabs', label: 'Cabs', icon: I(Car), module: 'cabs' },
      { path: '/photos', label: 'Photos', icon: I(Images), module: 'photos' },
    ] },
    { label: 'Marketing', items: [
      { path: '/newsletter', label: 'Newsletter', icon: I(Mail), module: 'leads' },
      ...(admin ? [{ path: '/website-content', label: 'Website Content', icon: I(Globe) }] : []),
      ...(admin ? [{ path: '/website-packages', label: 'Website Packages', icon: I(Package) }] : []),
    ] },
    { label: 'Reports', items: [
      { path: '/income', label: 'Revenue', icon: I(TrendingUp), module: 'income' },
      { path: '/expenses', label: 'Expenses', icon: I(Wallet), module: 'expenses' },
      { path: '/audit-logs', label: 'Audit Logs', icon: I(ScrollText), module: 'audit_logs' },
    ] },
    { label: 'Admin', items: [
      ...(admin ? [{ path: '/users', label: 'Users & Roles', icon: I(ShieldCheck) }] : []),
    ] },
  ]

  const navGroups = allNavGroups
    .map(g => ({ ...g, items: g.items.filter(item => !item.module || hasAccess(item.module)) }))
    .filter(g => g.items.length > 0)

  const navItems = navGroups.flatMap(g => g.items)
  const settingsItem = hasAccess('admin') ? { path: '/admin', label: 'Settings', icon: I(Settings) } : null

  const mobileNavItems = [...navItems, ...(settingsItem ? [settingsItem] : [])].filter(item =>
    ['/', '/leads', '/bookings', '/itinerary', '/admin'].includes(item.path)
  )

  const renderItem = (item) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/'}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      onClick={() => setSidebarOpen(false)}
    >
      <span className="nav-icon">{item.icon}</span>
      <span className="nav-label">{item.label}</span>
    </NavLink>
  )

  return (
    <div className={`layout-wrapper ${collapsed ? 'collapsed' : ''}`}>
      <div className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar-nav ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-top">
          <NavLink to="/" className="brand" onClick={() => setSidebarOpen(false)} title={BRAND.legalName}>
            <BrandMark className="brand-logo-full" variant="full" size={62} />
          </NavLink>
          <button className="sidebar-toggle" onClick={toggleCollapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <BrandMark size={40} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="nav-links">
          {navGroups.map(group => (
            <div key={group.label} className="nav-group">
              <div className="nav-group-label">{group.label}</div>
              {group.items.map(renderItem)}
            </div>
          ))}
        </nav>

        {settingsItem && <div className="nav-footer">{renderItem(settingsItem)}</div>}
      </aside>

      <main className="main-viewport">
        <header className="main-header">
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <GlobalSearch />
          </div>
          <div className="header-right">
            {headerActions && <div className="header-actions-wrap">{headerActions}</div>}
            {isDemo && <span className="demo-chip" title="Running on sample data">Demo Mode</span>}
            <Notifications />
            <UserMenu session={session} onLogout={handleLogout} />
          </div>
        </header>

        <div className="page-workspace animate-fade" key={location.pathname}>
          {children}
        </div>
      </main>

      <nav className="bottom-nav">
        {mobileNavItems.map(item => {
          const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
          return (
            <NavLink key={item.path} to={item.path} className={`bottom-nav-item ${isActive ? 'active' : ''}`}>
              <span className="bottom-nav-icon">{item.icon}</span>
              <span className="bottom-nav-label">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
