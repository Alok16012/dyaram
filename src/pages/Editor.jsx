import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, NavLink } from 'react-router-dom'
import { usePackage } from '../context/PackageContext'
import DayBuilder from '../components/DayBuilder'
import PreviewModal from '../components/PreviewModal'
import InfoTab from '../components/tabs/InfoTab'
import PhotosTab from '../components/tabs/PhotosTab'
import PricingTab from '../components/tabs/PricingTab'
import TCTab from '../components/tabs/TCTab'
import toast from 'react-hot-toast'

export default function Editor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    currentPackage: pkg, prices, days, loading, saveStatus,
    loadPackage, fetchLibrary, saveAll,
  } = usePackage()

  const [activeTab, setActiveTab] = useState('info')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [tabsSheetOpen, setTabsSheetOpen] = useState(false)
  const saveRef = useRef(null)

  // Always keep latest data in refs so we can save on unmount
  const pkgRef    = useRef(pkg)
  const pricesRef = useRef(prices)
  const daysRef   = useRef(days)
  useEffect(() => { pkgRef.current    = pkg    }, [pkg])
  useEffect(() => { pricesRef.current = prices }, [prices])
  useEffect(() => { daysRef.current   = days   }, [days])

  useEffect(() => {
    if (id) {
      loadPackage(id)
      fetchLibrary()
    }
  }, [id])

  // Auto-save debounced (800ms — fast enough to beat mobile navigation)
  useEffect(() => {
    if (!pkg?.id) return
    clearTimeout(saveRef.current)
    saveRef.current = setTimeout(() => saveAll(pkg, prices, days), 800)
    return () => clearTimeout(saveRef.current)
  }, [pkg, prices, days])

  // Save immediately on unmount — prevents data loss when user navigates away
  useEffect(() => {
    return () => {
      const p  = pkgRef.current
      const pr = pricesRef.current
      const d  = daysRef.current
      if (p?.id) {
        clearTimeout(saveRef.current)
        saveAll(p, pr, d)
      }
    }
  }, [saveAll])

  if (loading && !pkg) {
    return <div className="loading-state"><div className="spinner" /></div>
  }

  if (!loading && !pkg) {
    return (
      <div className="empty-state">
        <h2>Package not found</h2>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Return Home</button>
      </div>
    )
  }

  const handlePrint = () => {
    setPreviewOpen(true)
    const originalTitle = document.title
    document.title = pkg?.title || 'Itinerary'
    setTimeout(() => {
      window.print()
      // Restore title after print dialog closes
      setTimeout(() => { document.title = originalTitle }, 1000)
    }, 500)
  }

  const tabs = [
    { id: 'info', label: 'Basics', icon: '📝' },
    { id: 'photos', label: 'Media', icon: '🖼️' },
    { id: 'pricing', label: 'Rates', icon: '💰' },
    { id: 'tc', label: 'T&C', icon: '📄' },
  ]

  const navGroups = [
    {
      label: 'Main',
      items: [
        { path: '/', label: 'Dashboard', icon: '📊' },
      ],
    },
    {
      label: 'Sales & CRM',
      items: [
        { path: '/leads', label: 'Leads', icon: '👥' },
        { path: '/bookings', label: 'Bookings', icon: '📅' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { path: '/itinerary', label: 'Itinerary', icon: '📋' },
        { path: '/invoices', label: 'Invoices', icon: '🧾' },
      ],
    },
    {
      label: 'Resources',
      items: [
        { path: '/hotels', label: 'Hotels', icon: '🏨' },
        { path: '/cabs', label: 'Cabs', icon: '🚕' },
        { path: '/photos', label: 'Photos', icon: '🖼️' },
      ],
    },
    {
      label: 'Admin',
      items: [
        { path: '/income', label: 'Income', icon: '💰' },
        { path: '/expenses', label: 'Expenses', icon: '📉' },
        { path: '/audit-logs', label: 'Audit Logs', icon: '📜' },
        { path: '/admin', label: 'Settings', icon: '⚙️' },
      ],
    },
  ]

  return (
    <div className="editor-layout">
      <div className={`editor-sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />
      
      <aside className={`editor-sidebar ${sidebarOpen ? 'open' : ''}`}>
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
          <button onClick={() => { localStorage.removeItem('shara_auth'); navigate('/login') }} className="logout-btn">
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="editor-canvas">
        <div className="editor-top-bar glass-card animate-fade">
          <div className="top-bar-left">
            <button className="icon-btn back-btn mobile-show" onClick={() => setSidebarOpen(true)}>☰</button>
            <button className="icon-btn back-btn mobile-hide" onClick={() => navigate('/')}>←</button>
            <div className="pkg-info">
              <h3 className="text-gradient">{pkg.title || 'Untitled Package'}</h3>
              <div className={`save-status ${saveStatus}`}>
                {saveStatus === 'saving' ? 'Saving changes...' : 'All changes saved'}
              </div>
            </div>
          </div>

          <div className="top-bar-actions">
            <button
              className="btn btn-ghost mobile-save-btn"
              onClick={() => {
                clearTimeout(saveRef.current)
                saveAll(pkg, prices, days).then(() => toast.success('Saved!'))
              }}
              title="Save now"
            >
              <span>💾</span><span className="mobile-save-label"> Save</span>
            </button>
            <button className="btn btn-ghost" onClick={() => setPreviewOpen(true)}>
              <span>👁️</span><span className="desktop-only"> Preview</span>
            </button>
            <button className="btn btn-primary" onClick={handlePrint}>
              <span>🖨️</span><span className="desktop-only"> Export PDF</span>
            </button>
          </div>
        </div>

        <div className="editor-workspace">
          <div className="editor-main-content">
            <div className="glass-card builder-container">
              <DayBuilder />
            </div>
          </div>

          <div className={`mobile-tabs-backdrop ${tabsSheetOpen ? 'active' : ''}`} onClick={() => setTabsSheetOpen(false)} />
          <aside className={`editor-sidebar-tabs glass-card ${tabsSheetOpen ? 'mobile-open' : ''}`}>
            <div className="tabs-header">
              {tabs.map(t => (
                <button
                  key={t.id}
                  className={`sidebar-tab ${activeTab === t.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(t.id)
                    setTabsSheetOpen(true)
                  }}
                >
                  <span className="icon">{t.icon}</span>
                  <span className="label">{t.label}</span>
                </button>
              ))}
              <button
                className="sidebar-tab mobile-show mobile-sheet-toggle"
                onClick={() => setTabsSheetOpen(o => !o)}
                aria-label="Toggle details panel"
              >
                <span className="icon">{tabsSheetOpen ? '▾' : '▴'}</span>
              </button>
            </div>

            <div className="tabs-content">
              {activeTab === 'info' && <InfoTab active />}
              {activeTab === 'photos' && <PhotosTab active />}
              {activeTab === 'pricing' && <PricingTab active />}
              {activeTab === 'tc' && <TCTab active />}
            </div>
          </aside>
        </div>
      </div>

      {previewOpen && (
        <PreviewModal open pkg={pkg} prices={prices} days={days}
          onClose={() => setPreviewOpen(false)}
          onPrint={handlePrint}
        />
      )}
    </div>
  )
}
