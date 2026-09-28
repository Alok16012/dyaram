import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Images, IndianRupee, ScrollText, Save, Eye, Printer } from 'lucide-react'
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
    { id: 'info', label: 'Basics', icon: <FileText size={17} /> },
    { id: 'photos', label: 'Media', icon: <Images size={17} /> },
    { id: 'pricing', label: 'Rates', icon: <IndianRupee size={17} /> },
    { id: 'tc', label: 'T&C', icon: <ScrollText size={17} /> },
  ]

  return (
    <div className="editor-page">
      <div className="editor-canvas">
        <div className="editor-top-bar glass-card animate-fade">
          <div className="top-bar-left">
            <button className="icon-action" onClick={() => navigate('/itinerary')} title="Back to itineraries"><ArrowLeft size={18} /></button>
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
              <Save size={16} /><span className="mobile-save-label"> Save</span>
            </button>
            <button className="btn btn-ghost" onClick={() => setPreviewOpen(true)}>
              <Eye size={16} /><span className="desktop-only"> Preview</span>
            </button>
            <button className="btn btn-primary" onClick={handlePrint}>
              <Printer size={16} /><span className="desktop-only"> Export PDF</span>
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
