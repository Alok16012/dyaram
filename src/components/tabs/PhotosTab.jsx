import { useRef, useState } from 'react'
import { usePackage } from '../../context/PackageContext'

export default function PhotosTab({ active }) {
  const { library, uploadToLibrary, deleteLibraryPhoto } = usePackage()
  const [tagType, setTagType] = useState('hotel')
  const [tagName, setTagName] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const handleUpload = async (e) => {
    const files = [...e.target.files]
    if (!files.length) return
    setUploading(true)
    for (const f of files) {
      await uploadToLibrary(f, tagType, tagName)
    }
    setUploading(false)
    e.target.value = ''
  }

  return (
    <div className={`tab-panel ${active ? 'active' : ''}`}>
      <div className="section-head">Photo Library</div>
      <p style={{ fontSize: 12, color: 'var(--gray)', lineHeight: 1.6 }}>
        Upload hotel &amp; location photos once. Reuse across all itineraries.
      </p>

      <div className="upload-zone" onClick={() => !uploading && fileRef.current?.click()}>
        <div className="upload-zone-icon">{uploading ? '⏳' : '📤'}</div>
        <p>{uploading ? 'Uploading…' : 'Click to upload photos'}</p>
        <p style={{ fontSize: 11, marginTop: 2 }}>JPG, PNG, WEBP</p>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleUpload} />
      </div>

      <div className="field">
        <label>Photo Type</label>
        <select className="glass-input" value={tagType} onChange={e => setTagType(e.target.value)}>
          <option value="hotel">🏨 Hotel</option>
          <option value="location">📍 Location / Scene</option>
        </select>
      </div>
      <div className="field">
        <label>Name (Hotel or Place)</label>
        <input className="glass-input" value={tagName} placeholder="e.g. Hotel Mid Town Green"
          onChange={e => setTagName(e.target.value)} />
      </div>

      <div className="lib-grid">
        {library.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state-icon">🖼️</div>
            <p>No photos yet. Upload some!</p>
          </div>
        ) : library.map(p => (
          <div key={p.id} className="lib-item">
            <img src={p.photo_url} alt={p.tag_name} loading="lazy" />
            <div className="lib-item-info">
              <span className="lib-item-name">{p.tag_name}</span>
              <span className="lib-item-type">{p.tag_type === 'hotel' ? '🏨' : '📍'} {p.tag_type}</span>
            </div>
            <button className="lib-item-del" onClick={() => deleteLibraryPhoto(p.id, p.photo_url)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
