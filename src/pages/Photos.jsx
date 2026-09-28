import { useState, useEffect } from 'react'
import { usePackage } from '../context/PackageContext'
import toast from 'react-hot-toast'
import { Upload, Search, Images, Hotel, MapPin, Eye, Trash2, X } from 'lucide-react'
import { PageHeader, StatCard, EmptyState, Pagination } from '../components/ui'
import { fmtDate } from '../lib/ui'

const PAGE_SIZE = 20

function UploadModal({ onSave, onClose }) {
  const [file, setFile] = useState(null)
  const [tagName, setTagName] = useState('')
  const [tagType, setTagType] = useState('location')
  const [uploading, setUploading] = useState(false)

  const submit = async () => {
    if (!file) {
      toast.error('Please choose a file')
      return
    }
    if (!tagName.trim()) {
      toast.error('Tag name is required')
      return
    }
    setUploading(true)
    await onSave(file, tagType, tagName.trim())
    setUploading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card animate-fade" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Upload Photo</h3>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body-custom">
          <div className="form-field">
            <label>Photo File</label>
            <input className="glass-input" type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Tag Name</label>
              <input className="glass-input" value={tagName} onChange={e => setTagName(e.target.value)} placeholder="e.g. Dal Lake, Hotel Grand" />
            </div>
            <div className="form-field">
              <label>Tag Type</label>
              <select className="glass-input" value={tagType} onChange={e => setTagType(e.target.value)}>
                <option value="location">Location</option>
                <option value="hotel">Hotel</option>
              </select>
            </div>
          </div>
        </div>

        <div className="modal-footer-custom">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload Photo'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Photos() {
  const { library, fetchLibrary, uploadToLibrary, deleteLibraryPhoto } = usePackage()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchLibrary()
      setLoading(false)
    }
    load()
  }, [fetchLibrary])

  const handleUpload = async (file, tagType, tagName) => {
    try {
      await uploadToLibrary(file, tagType, tagName)
      toast.success('Photo uploaded')
      setShowUpload(false)
    } catch (err) {
      console.error('Upload error:', err)
    }
  }

  const handleDelete = async (id, url) => {
    if (window.confirm('Delete this photo?')) {
      try {
        await deleteLibraryPhoto(id, url)
        toast.success('Photo deleted')
      } catch {
        toast.error('Failed to delete photo')
      }
    }
  }

  const filteredLibrary = (library || []).filter(p => {
    const q = search.toLowerCase()
    return (p.tag_name || '').toLowerCase().includes(q) && (typeFilter === 'all' || p.tag_type === typeFilter)
  })

  const totalPages = Math.max(1, Math.ceil(filteredLibrary.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedLibrary = filteredLibrary.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const all = library || []
  const TYPES = [['all', 'All'], ['location', 'Locations'], ['hotel', 'Hotels']]

  return (
    <div>
      <PageHeader
        title="Photos"
        subtitle="Photo library used in itineraries and quotes"
        actions={<button className="btn btn-primary" onClick={() => setShowUpload(true)}><Upload size={16} /> Upload Photo</button>}
      />

      <div className="kpi-grid">
        <StatCard icon={Images} tone="blue" label="Total Photos" value={all.length} />
        <StatCard icon={MapPin} tone="green" label="Location Photos" value={all.filter(p => p.tag_type === 'location').length} />
        <StatCard icon={Hotel} tone="purple" label="Hotel Photos" value={all.filter(p => p.tag_type === 'hotel').length} />
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="toolbar-search">
            <Search size={16} />
            <input placeholder="Search by tag name..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <div className="tabs-line">
            {TYPES.map(([id, label]) => (
              <button key={id} className={`tab-line ${typeFilter === id ? 'active' : ''}`} onClick={() => { setTypeFilter(id); setPage(1) }}>{label}</button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : filteredLibrary.length === 0 ? (
          <EmptyState icon={Images} title="No photos found" text="Upload location and hotel photos to reuse them in itineraries."
            action={<button className="btn btn-primary btn-sm" onClick={() => setShowUpload(true)}><Upload size={15} /> Upload Photo</button>} />
        ) : (
          <>
            <div className="photo-gallery">
              {pagedLibrary.map(photo => (
                <div key={photo.id} className="photo-tile">
                  <div className="photo-thumb" style={{ backgroundImage: `url("${photo.photo_url}")` }}>
                    <div className="photo-overlay">
                      <button className="icon-action" onClick={() => window.open(photo.photo_url, '_blank')} title="View full size"><Eye size={15} /></button>
                      <button className="icon-action danger" onClick={() => handleDelete(photo.id, photo.photo_url)} title="Delete"><Trash2 size={15} /></button>
                    </div>
                    <span className={`photo-type ${photo.tag_type === 'hotel' ? 'hotel' : ''}`}>
                      {photo.tag_type === 'hotel' ? <Hotel size={12} /> : <MapPin size={12} />} {photo.tag_type || 'location'}
                    </span>
                  </div>
                  <div className="photo-meta">
                    <div className="cell-strong">{photo.tag_name || 'Untitled'}</div>
                    <div className="cell-sub">Added {fmtDate(photo.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filteredLibrary.length} onChange={setPage} noun="photos" />
          </>
        )}
      </div>

      {showUpload && (
        <UploadModal onSave={handleUpload} onClose={() => setShowUpload(false)} />
      )}

    </div>
  )
}
