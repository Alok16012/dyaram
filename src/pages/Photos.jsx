import { useState, useEffect } from 'react'
import { usePackage } from '../context/PackageContext'
import toast from 'react-hot-toast'

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
          <button className="modal-close-btn" onClick={onClose}>✕</button>
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
      } catch (err) {
        toast.error('Failed to delete photo')
      }
    }
  }

  const filteredLibrary = (library || []).filter(p => {
    const q = search.toLowerCase()
    return (p.tag_name || '').toLowerCase().includes(q)
  })

  const totalPages = Math.max(1, Math.ceil(filteredLibrary.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedLibrary = filteredLibrary.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const rangeStart = filteredLibrary.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredLibrary.length)

  const typeColors = {
    hotel: { color: '#2563EB', bg: 'rgba(37, 99, 235, 0.12)' },
    location: { color: '#059669', bg: 'rgba(5, 150, 105, 0.12)' },
  }

  return (
    <div className="photos-dashboard">
      <div className="photos-header">
        <div>
          <h1 className="text-gradient">Photos</h1>
          <p className="text-muted">{(library || []).length} photos in library</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
          + Upload Photo
        </button>
      </div>

      <div className="filter-row">
        <input className="glass-input search-input" placeholder="Search by tag name..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <div className="glass-card photos-table-card">
          {filteredLibrary.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🖼️</div>
              <h3>No photos found</h3>
              <p>Upload your first photo to get started</p>
            </div>
          ) : (
            <div className="photos-table-scroll">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Thumbnail</th>
                    <th>Tag Name</th>
                    <th>Type</th>
                    <th>Uploaded</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLibrary.map(photo => {
                    const tc = typeColors[photo.tag_type] || typeColors.location
                    return (
                      <tr key={photo.id}>
                        <td>
                          <img
                            src={photo.photo_url}
                            alt={photo.tag_name || 'photo'}
                            loading="lazy"
                            style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover' }}
                          />
                        </td>
                        <td style={{ fontWeight: 700 }}>{photo.tag_name || '—'}</td>
                        <td>
                          <span className="type-badge" style={{ color: tc.color, background: tc.bg }}>
                            {photo.tag_type || '—'}
                          </span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {photo.created_at
                            ? new Date(photo.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                            : '—'}
                        </td>
                        <td>
                          <div className="photo-actions">
                            <button className="action-btn" onClick={() => window.open(photo.photo_url, '_blank')} title="View full size">👁️</button>
                            <button className="action-btn delete" onClick={() => handleDelete(photo.id, photo.photo_url)} title="Delete">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--border-glass)', flexWrap: 'wrap', gap: 12 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>Showing {rangeStart}–{rangeEnd} of {filteredLibrary.length}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</button>
                <span style={{ fontSize: 12.5, color: 'var(--text-dim)', padding: '0 6px' }}>Page {currentPage} of {totalPages}</span>
                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} disabled={currentPage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showUpload && (
        <UploadModal onSave={handleUpload} onClose={() => setShowUpload(false)} />
      )}

      <style jsx>{`
        .photos-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 24px;
          gap: 16px;
        }
        .photos-header h1 { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
        .photos-header .btn { white-space: nowrap; }

        .filter-row { margin-bottom: 20px; }
        .search-input { max-width: 320px; }

        .photos-table-card { padding: 0; overflow: hidden; }
        .photos-table-scroll { overflow-x: auto; }

        .type-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          white-space: nowrap;
          text-transform: capitalize;
        }

        .photo-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
          justify-content: flex-end;
        }
        .action-btn {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          border: 1px solid var(--border-glass);
          background: #F8FAFC;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 13px;
          transition: all 0.15s;
        }
        .action-btn:hover {
          background: #F1F5F9;
          transform: scale(1.05);
        }
        .action-btn.delete:hover {
          background: rgba(239,68,68,0.12);
          border-color: #ef4444;
        }

        .empty-state {
          padding: 48px 20px;
          text-align: center;
        }
        .empty-state-icon { font-size: 48px; margin-bottom: 12px; }
        .empty-state h3 { font-size: 18px; margin-bottom: 6px; }
        .empty-state p { color: var(--text-dim); }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .modal-content {
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-glass);
        }
        .modal-header h3 { font-size: 18px; font-weight: 800; }
        .modal-close-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #F1F5F9;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          font-size: 14px;
        }
        .modal-close-btn:hover {
          background: rgba(239,68,68,0.2);
          color: #ef4444;
        }
        .modal-body-custom {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .form-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .form-field label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .modal-footer-custom {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid var(--border-glass);
          background: #F8FAFC;
        }

        @media (max-width: 768px) {
          .photos-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .photos-header h1 { font-size: 22px; }
          .photos-header .btn { width: 100%; justify-content: center; }

          .modal-content { max-height: 95vh; }
          .modal-header { padding: 16px 20px; }
          .modal-header h3 { font-size: 16px; }
          .modal-body-custom { padding: 16px 20px; }
          .modal-footer-custom { padding: 12px 20px; }
        }
        @media (max-width: 480px) {
          .form-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
