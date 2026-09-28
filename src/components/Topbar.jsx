import { Link, useNavigate } from 'react-router-dom'
import { usePackage } from '../context/PackageContext'
import { isConfigured } from '../lib/supabase'

export default function Topbar({ mode = 'home', packageTitle = '', onPreview, onPrint }) {
  const { saveStatus, createNewPackage } = usePackage()
  const navigate = useNavigate()

  const handleNew = async () => {
    if (!window.confirm('Naya package banana hai?')) return
    const id = await createNewPackage()
    if (id) navigate(`/editor/${id}`)
  }

  return (
    <nav className="topbar">
      <div className="topbar-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <img src="/logo.png" alt="Shera Travels" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
        <span>Shera Travels</span>
        <span className="topbar-badge">Itinerary Maker</span>
      </div>

      {mode === 'editor' && (
        <div className="topbar-center">
          {packageTitle || 'Untitled Package'}
        </div>
      )}

      <div className="topbar-actions">
        {/* Connection status badge — visible on all modes */}
        <div className={`topbar-conn ${isConfigured ? 'topbar-conn-ok' : 'topbar-conn-off'}`}>
          <span className="topbar-conn-dot" />
          <span className="topbar-conn-label">
            {isConfigured ? 'Cloud' : 'Local'}
          </span>
        </div>

        {mode === 'editor' ? (
          <>
            <div className="save-indicator">
              {saveStatus === 'saving' && <><div className="save-dot" />Saving…</>}
              {saveStatus === 'saved' && <>✓ Saved</>}
              {saveStatus === 'unsaved' && <>• Pending</>}
            </div>
            <Link to="/" className="btn-topbar btn-home">
              <span>🏠</span><span>Home</span>
            </Link>
            <button className="btn-topbar btn-preview" onClick={onPreview}>
              <span>👁</span><span>Preview</span>
            </button>
            <button className="btn-topbar btn-print" onClick={onPrint}>
              <span>🖨️</span><span>PDF</span>
            </button>
          </>
        ) : mode === 'admin' ? (
          <Link to="/" className="btn-topbar btn-home">
            <span>🏠</span><span>Home</span>
          </Link>
        ) : (
          <>
            <Link to="/" className="btn-topbar" style={{ background: 'linear-gradient(135deg,#4F6EF7,#6366F1)', color: '#fff', border: 'none' }}>
              <span>📊</span><span>CRM</span>
            </Link>
            <Link to="/admin" className="btn-topbar btn-admin-nav">
              <span>⚙️</span><span>Admin</span>
            </Link>
            <button className="btn-topbar btn-print" onClick={handleNew}>
              <span>+</span><span>New Package</span>
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
