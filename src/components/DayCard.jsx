import { useState } from 'react'
import { usePackage } from '../context/PackageContext'
import toast from 'react-hot-toast'

const MEALS = ['Stay', 'Breakfast', 'Lunch', 'Dinner']
const THEME_OPTIONS = [
  'Adventure', 'Sightseeing', 'Pilgrimage', 'Honeymoon', 'Family', 'Wildlife',
  'Beach', 'Hill Station', 'Cultural', 'Heritage', 'Trekking', 'Wellness',
  'Leisure', 'Nature', 'Shopping', 'Nightlife',
]

export default function DayCard({ day, idx }) {
  const { updateDay, removeDay, toggleDayOpen, moveDay, library, setDayPhoto, removeDayPhoto, setHotelPhoto } = usePackage()
  const [pickerTarget, setPickerTarget] = useState(null) // 'slot-0','slot-1','slot-2','hotel'
  const [pickerSearch, setPickerSearch] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [dragging, setDragging] = useState(false)

  const handleDragStart = (e) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
    setDragging(true)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!dragOver) setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (!Number.isNaN(fromIdx)) moveDay(fromIdx, idx)
  }

  const handleDragEnd = () => {
    setDragging(false)
    setDragOver(false)
  }

  const photos = day.day_photos || []
  const getPhoto = (slot) => photos.find(p => p.slot_index === slot) || null

  const openPicker = (target) => {
    if (library.length === 0) {
      toast.error('Upload photos in the Photos tab first!')
      return
    }
    setPickerSearch('')
    setPickerTarget(target)
  }

  const filteredLibrary = library.filter(p =>
    (p.tag_name || '').toLowerCase().includes(pickerSearch.toLowerCase())
  )

  const handlePickerSelect = async (photo) => {
    setPickerTarget(null)
    try {
      if (pickerTarget === 'hotel') {
        await setHotelPhoto(idx, photo)
      } else {
        const slot = parseInt(pickerTarget.replace('slot-', ''))
        await setDayPhoto(idx, slot, photo)
      }
    } catch (e) {
      toast.error('Failed to assign photo: ' + (e.message || 'Unknown error'))
    }
  }

  const addTag = (field, val) => {
    val = val.trim().replace(/,$/, '')
    if (!val) return
    const arr = day[field] || []
    if (!arr.includes(val)) updateDay(idx, field, [...arr, val])
  }

  const removeTag = (field, i) => {
    const arr = [...(day[field] || [])]
    arr.splice(i, 1)
    updateDay(idx, field, arr)
  }

  const toggleMeal = (meal) => {
    const meals = [...(day.meals || [])]
    const i = meals.indexOf(meal)
    if (i === -1) meals.push(meal)
    else meals.splice(i, 1)
    updateDay(idx, 'meals', meals)
  }

  return (
    <div
      className={`day-card ${dragging ? 'dragging' : ''} ${dragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="day-header" onClick={() => toggleDayOpen(idx)}>
        <div className="day-header-left">
          <span
            className="day-drag-handle"
            draggable
            title="Drag to reorder"
            onClick={e => e.stopPropagation()}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >⠿</span>
          <div className="day-num">{idx + 1}</div>
          <input
            className="day-title-input"
            value={day.title || ''}
            placeholder={`Day ${idx + 1}: Enter title...`}
            onClick={e => e.stopPropagation()}
            onChange={e => updateDay(idx, 'title', e.target.value)}
          />
        </div>
        <div className="day-header-actions">
          <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); if (window.confirm('Remove this day?')) removeDay(idx) }}>🗑</button>
          <span className={`day-chevron ${day._open ? 'open' : ''}`}>▾</span>
        </div>
      </div>

      {/* Body */}
      <div className={`day-body ${day._open ? 'open' : ''}`}>

        {/* Activity Photos */}
        <div>
          <span className="day-field-label">Activity / Scene Photos (up to 3)</span>
          <div className="photo-grid-3">
            {[0, 1, 2].map(slot => {
              const ph = getPhoto(slot)
              return (
                <div key={slot} className="photo-slot" onClick={() => openPicker(`slot-${slot}`)}>
                  {ph ? (
                    <>
                      <img src={ph.photo_url} alt={ph.tag_name} loading="lazy" />
                      <div className="photo-label">{ph.tag_name || ''}</div>
                      <button className="photo-remove" onClick={e => { e.stopPropagation(); removeDayPhoto(idx, slot) }}>✕</button>
                    </>
                  ) : (
                    <div className="photo-slot-add">+</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Description */}
        <div className="field">
          <label>Day Description</label>
          <textarea
            className="glass-input"
            value={day.description || ''}
            placeholder="Describe the day's activities..."
            onChange={e => updateDay(idx, 'description', e.target.value)}
          />
        </div>

        {/* Distance */}
        <div className="field">
          <label>Distance / Duration (optional)</label>
          <input
            className="glass-input"
            value={day.distance || ''}
            placeholder="e.g. 97 KMS / 03:30 HRS one way"
            onChange={e => updateDay(idx, 'distance', e.target.value)}
          />
        </div>

        {/* Hotspots */}
        <div className="field">
          <label>Hotspots</label>
          <div className="tag-input-wrap">
            {(day.hotspots || []).map((h, i) => (
              <span key={i} className="tag">{h}
                <span className="tag-x" onClick={() => removeTag('hotspots', i)}>✕</span>
              </span>
            ))}
            <input
              className="glass-input"
              placeholder="Type & Enter..."
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') {
                  addTag('hotspots', e.target.value)
                  e.target.value = ''
                  e.preventDefault()
                }
              }}
            />
          </div>
        </div>

        {/* Themes */}
        <div className="field">
          <label>Themes</label>
          <select
            className="glass-input"
            style={{ marginBottom: 8 }}
            value=""
            onChange={e => {
              if (e.target.value) addTag('themes', e.target.value)
            }}
          >
            <option value="">+ Select a theme to add...</option>
            {THEME_OPTIONS.filter(t => !(day.themes || []).includes(t)).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <div className="tag-input-wrap">
            {(day.themes || []).map((t, i) => (
              <span key={i} className="tag green">{t}
                <span className="tag-x" onClick={() => removeTag('themes', i)}>✕</span>
              </span>
            ))}
            <input
              className="glass-input"
              placeholder="Or type a custom theme & Enter..."
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') {
                  addTag('themes', e.target.value)
                  e.target.value = ''
                  e.preventDefault()
                }
              }}
            />
          </div>
        </div>

        {/* Meals */}
        <div className="field">
          <label>Meals Included</label>
          <div className="check-group">
            {MEALS.map(m => (
              <label key={m} className={`check-pill ${(day.meals || []).includes(m) ? 'active' : ''}`}>
                <input type="checkbox"
                  checked={(day.meals || []).includes(m)}
                  onChange={() => toggleMeal(m)}
                />
                {m}
              </label>
            ))}
          </div>
        </div>

        {/* Accommodation */}
        <div className="grid-2">
          <div className="field">
            <label>Accommodation (Hotel Name)</label>
            <input
              className="glass-input"
              value={day.accommodation || ''}
              placeholder="e.g. Hotel Mid Town Green"
              onChange={e => updateDay(idx, 'accommodation', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Stars</label>
            <div className="star-select">
              {[1, 2, 3, 4, 5].map(n => (
                <span key={n}
                  className={(day.accom_star || 3) >= n ? 'on' : ''}
                  onClick={() => updateDay(idx, 'accom_star', n)}
                >★</span>
              ))}
            </div>
          </div>
        </div>

        {/* Hotel Photo */}
        <div>
          <span className="day-field-label">Hotel Photo</span>
          <div className="photo-slot" style={{ aspectRatio: '16/7', width: '100%', borderRadius: 10 }}
            onClick={() => openPicker('hotel')}>
            {day.hotel_photo_url ? (
              <>
                <img src={day.hotel_photo_url} alt="Hotel" loading="lazy" />
                <button className="photo-remove" onClick={e => { e.stopPropagation(); updateDay(idx, 'hotel_photo_url', null) }}>✕</button>
              </>
            ) : (
              <div className="photo-slot-add">🏨</div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Picker Modal */}
      {pickerTarget && (
        <div className="modal-overlay open" onClick={() => setPickerTarget(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-top">
              <h3>📸 Select from Library</h3>
              <button className="modal-close" onClick={() => setPickerTarget(null)}>✕</button>
            </div>
            <div className="modal-search">
              <input
                className="glass-input"
                autoFocus
                placeholder="Search by name..."
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
              />
            </div>
            <div className="modal-body">
              {filteredLibrary.length === 0 ? (
                <div className="picker-empty">No photos match &quot;{pickerSearch}&quot;.</div>
              ) : filteredLibrary.map(p => (
                <div key={p.id} className="picker-item" onClick={() => handlePickerSelect(p)}>
                  <img src={p.photo_url} alt={p.tag_name} loading="lazy" />
                  <div className="picker-item-label">{p.tag_name}</div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-sm" onClick={() => setPickerTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
