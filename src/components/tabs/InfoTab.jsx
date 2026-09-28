import { useState, useRef } from 'react'
import { usePackage } from '../../context/PackageContext'

function ListAddRow({ placeholder, onAdd }) {
  const inputRef = useRef(null)
  return (
    <div className="list-add-row">
      <input
        className="glass-input"
        ref={inputRef}
        placeholder={placeholder}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            onAdd(inputRef.current.value)
            inputRef.current.value = ''
          }
        }}
      />
      <button className="list-add-btn" onClick={() => {
        onAdd(inputRef.current.value)
        inputRef.current.value = ''
      }}>+</button>
    </div>
  )
}

export default function InfoTab({ active }) {
  const { currentPackage: pkg, updateField, library, setHeroPhoto } = usePackage()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')

  if (!pkg) return null

  const filteredLibrary = library.filter(p =>
    (p.tag_name || '').toLowerCase().includes(pickerSearch.toLowerCase())
  )

  const inc = pkg.inclusions || []
  const exc = pkg.exclusions || []

  return (
    <div className={`tab-panel ${active ? 'active' : ''}`}>
      <div className="section-head">Package Details</div>

      <div className="field">
        <label>Package Title</label>
        <input
          className="glass-input"
          value={pkg.title || ''}
          placeholder="e.g. 5 Nights 6 Days Kashmir Tour"
          onChange={e => updateField('title', e.target.value)}
        />
      </div>
      <div className="field">
        <label>Sub-title / Tagline</label>
        <input
          className="glass-input"
          value={pkg.sub_title || ''}
          placeholder="e.g. Shera Travels — Let's Travel The World"
          onChange={e => updateField('sub_title', e.target.value)}
        />
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Nights</label>
          <input className="glass-input" type="number" min="1" value={pkg.nights || 5}
            onChange={e => updateField('nights', parseInt(e.target.value) || 1)} />
        </div>
        <div className="field">
          <label>Days</label>
          <input className="glass-input" type="number" min="1" value={pkg.days || 6}
            onChange={e => updateField('days', parseInt(e.target.value) || 1)} />
        </div>
      </div>
      <div className="field">
        <label>Starting From</label>
        <input className="glass-input" value={pkg.start_location || ''} placeholder="e.g. Srinagar, J&K"
          onChange={e => updateField('start_location', e.target.value)} />
      </div>

      <div className="field">
        <label>Hero / Cover Photo</label>
        <div
          className="photo-slot"
          style={{ aspectRatio: '16/7', width: '100%', borderRadius: '10px' }}
          onClick={() => { setPickerSearch(''); setPickerOpen(true) }}
        >
          {pkg.hero_photo_url
            ? <img src={pkg.hero_photo_url} alt="Hero" />
            : <div className="photo-slot-add">🏔️</div>
          }
        </div>
      </div>

      <div className="section-head">Inclusions</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {inc.map((item, i) => (
          <div className="list-item" key={i}>
            <span>✓ {item}</span>
            <button className="list-item-del"
              onClick={() => updateField('inclusions', inc.filter((_, idx) => idx !== i))}>✕</button>
          </div>
        ))}
      </div>
      <ListAddRow placeholder="Add inclusion… (Enter)" onAdd={v => { if (v.trim()) updateField('inclusions', [...inc, v.trim()]) }} />

      <div className="section-head">Exclusions</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {exc.map((item, i) => (
          <div className="list-item" key={i}>
            <span>✗ {item}</span>
            <button className="list-item-del"
              onClick={() => updateField('exclusions', exc.filter((_, idx) => idx !== i))}>✕</button>
          </div>
        ))}
      </div>
      <ListAddRow placeholder="Add exclusion… (Enter)" onAdd={v => { if (v.trim()) updateField('exclusions', [...exc, v.trim()]) }} />

      {/* Hero Photo Picker Modal */}
      {pickerOpen && (
        <div className="modal-overlay open" onClick={() => setPickerOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-top">
              <h3>📸 Select Cover Photo</h3>
              <button className="modal-close" onClick={() => setPickerOpen(false)}>✕</button>
            </div>
            {library.length > 0 && (
              <div className="modal-search">
                <input
                  className="glass-input"
                  autoFocus
                  placeholder="Search by name..."
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                />
              </div>
            )}
            <div className="modal-body">
              {library.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <p>Upload photos in the Photos tab first.</p>
                </div>
              ) : filteredLibrary.length === 0 ? (
                <div className="picker-empty">No photos match &quot;{pickerSearch}&quot;.</div>
              ) : filteredLibrary.map(p => (
                <div key={p.id} className="picker-item"
                  onClick={() => { setHeroPhoto(p); setPickerOpen(false) }}>
                  <img src={p.photo_url} alt={p.tag_name} />
                  <div className="picker-item-label">{p.tag_name}</div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-sm" onClick={() => setPickerOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
