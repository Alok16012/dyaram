import { usePackage } from '../../context/PackageContext'

const PRESETS = [
  { label: 'Adult',  pax_type: 'Adult',  age_limit: 'Above 12 years', price: '' },
  { label: 'Child',  pax_type: 'Child',  age_limit: '5–12 years',     price: '' },
  { label: 'Infant', pax_type: 'Infant', age_limit: 'Below 5 years',  price: '0' },
  { label: 'Senior', pax_type: 'Senior', age_limit: '60+ years',      price: '' },
]

function formatInr(val) {
  const num = Number(val)
  if (!val && val !== 0) return ''
  if (isNaN(num)) return val
  return num.toLocaleString('en-IN')
}

export default function PricingTab({ active }) {
  const { prices, addPrice, addPricePreset, updatePrice, removePrice, days } = usePackage()

  // Unique hotels from days
  const hotels = []
  const seen = new Set()
  ;(days || []).forEach(d => {
    if (d.accommodation && !seen.has(d.accommodation)) {
      seen.add(d.accommodation)
      hotels.push({ name: d.accommodation, star: d.accom_star || 3 })
    }
  })

  const minPrice = prices.length > 0
    ? Math.min(...prices.filter(p => p.price > 0).map(p => Number(p.price)))
    : null

  return (
    <div className={`tab-panel ${active ? 'active' : ''}`}>

      {/* ── SECTION HEAD ── */}
      <div className="section-head">Price &amp; Rates</div>

      {/* ── QUICK ADD PRESETS ── */}
      <div className="price-quick-add">
        <span className="price-quick-label">Quick Add:</span>
        <div className="price-quick-btns">
          {PRESETS.map(preset => {
            const exists = prices.some(p => p.pax_type === preset.pax_type)
            return (
              <button
                key={preset.pax_type}
                className={`price-quick-btn ${exists ? 'exists' : ''}`}
                onClick={() => addPricePreset(preset)}
                disabled={exists}
                title={exists ? 'Already added' : `Add ${preset.pax_type}`}
              >
                + {preset.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── PRICE ROWS ── */}
      <div className="price-rows">
        {prices.length === 0 && (
          <div className="price-empty">
            <span>💰</span>
            <p>Koi price nahi hai abhi</p>
            <p>Upar se Quick Add karo ya neeche + button use karo</p>
          </div>
        )}

        {prices.map((row, i) => (
          <div className="price-row-card" key={i}>
            <div className="price-row-number">#{i + 1}</div>
            <div className="price-row-fields">
              <div className="price-row-field">
                <label>Pax Type</label>
                <input
                  className="glass-input"
                  value={row.pax_type || ''}
                  placeholder="e.g. Adult"
                  onChange={e => updatePrice(i, 'pax_type', e.target.value)}
                />
              </div>
              <div className="price-row-field">
                <label>Age Limit</label>
                <input
                  className="glass-input"
                  value={row.age_limit || ''}
                  placeholder="e.g. Above 12 yrs"
                  onChange={e => updatePrice(i, 'age_limit', e.target.value)}
                />
              </div>
              <div className="price-row-field">
                <label>Price (₹)</label>
                <div className="price-inr-input">
                  <span className="price-inr-symbol">₹</span>
                  <input
                    className="glass-input"
                    type="number"
                    value={row.price || ''}
                    placeholder="17500"
                    min="0"
                    onChange={e => updatePrice(i, 'price', e.target.value)}
                  />
                  {row.price > 0 && (
                    <span className="price-inr-formatted">{formatInr(row.price)}</span>
                  )}
                </div>
              </div>
            </div>
            <button
              className="price-row-del"
              onClick={() => removePrice(i)}
              title="Remove"
            >✕</button>
          </div>
        ))}
      </div>

      <button className="price-add-btn" onClick={addPrice}>
        + Row Add Karo
      </button>

      {/* ── PRICE SUMMARY ── */}
      {prices.filter(p => p.price > 0).length > 0 && (
        <div className="price-summary-card">
          <div className="price-summary-head">💰 Price Summary</div>
          {prices.filter(p => p.pax_type && p.price > 0).map((p, i) => (
            <div className="price-summary-line" key={i}>
              <span className="price-summary-type">{p.pax_type}</span>
              {p.age_limit && <span className="price-summary-age">{p.age_limit}</span>}
              <span className="price-summary-val">₹{formatInr(p.price)}</span>
            </div>
          ))}
          {minPrice && prices.filter(p => p.price > 0).length > 1 && (
            <div className="price-summary-line price-summary-min">
              <span>Starting from</span>
              <span className="price-min-val">₹{formatInr(minPrice)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── ACCOMMODATION ── */}
      <div className="section-head" style={{ marginTop: 4 }}>Accommodation</div>
      {hotels.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--gray)' }}>
          Hotels auto-fill hote hain Day entries se.
        </p>
      ) : hotels.map((h, i) => (
        <div className="list-item" key={i}>
          <span>🏨 {h.name}</span>
          <span style={{ color: 'var(--orange)', fontSize: 12 }}>{'★'.repeat(h.star)}</span>
        </div>
      ))}
    </div>
  )
}
