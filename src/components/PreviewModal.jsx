import { useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import toast from 'react-hot-toast'
// public/ assets are served by URL — importing them base64-inlines the file
// into the JS bundle, so reference by path instead to keep the chunk small.
const logoUrl = '/logo.png'

export default function PreviewModal({ open, onClose, onPrint, pkg, prices, days }) {
  const [sharing, setSharing] = useState(false)

  if (!open) return null

  const generatePdf = async () => {
    const el = document.getElementById('preview-doc')
    const canvas = await html2canvas(el, {
      useCORS: true,
      allowTaint: false,
      scale: 2,
      logging: false,
      backgroundColor: '#ffffff',
      imageTimeout: 15000,
      onclone: (doc) => {
        doc.getElementById('preview-doc').style.maxHeight = 'none'
      },
    })

    const pdf     = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
    const pageW   = pdf.internal.pageSize.getWidth()
    const pageH   = pdf.internal.pageSize.getHeight()
    const imgW    = pageW
    const imgH    = (canvas.height * pageW) / canvas.width
    const imgData = canvas.toDataURL('image/jpeg', 0.92)

    pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH)
    let remaining = imgH - pageH
    let page = 1
    while (remaining > 0) {
      pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, -(page * pageH), imgW, imgH)
      remaining -= pageH
      page++
    }
    return pdf
  }

  const downloadPdf = async () => {
    setSharing(true)
    const toastId = toast.loading('Generating PDF...')
    try {
      const pdf = await generatePdf()
      const clientName = pkg?.client_name ? ` - ${pkg.client_name}` : ''
      const filename = `${pkg?.title || 'Itinerary'}${clientName}.pdf`
      pdf.save(filename)
      toast.dismiss(toastId)
      toast.success('PDF downloaded!')
    } catch (err) {
      toast.dismiss(toastId)
      toast.error('Could not generate PDF. Try Print → Save as PDF instead.')
      console.error('PDF download error:', err)
    } finally {
      setSharing(false)
    }
  }

  const sharePdfOnWhatsApp = async () => {
    setSharing(true)
    const toastId = toast.loading('Generating PDF...')
    try {
      const pdf = await generatePdf()
      const clientName = pkg?.client_name ? ` - ${pkg.client_name}` : ''
      const filename = `${pkg?.title || 'Itinerary'}${clientName}.pdf`
      const blob = pdf.output('blob')
      const file = new File([blob], filename, { type: 'application/pdf' })

      toast.dismiss(toastId)

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: filename, files: [file] })
        toast.success('Shared!')
      } else {
        const url = URL.createObjectURL(blob)
        const a   = document.createElement('a')
        a.href = url; a.download = filename; a.click()
        URL.revokeObjectURL(url)
        toast.success('PDF downloaded! Open WhatsApp → attach the file.', { duration: 5000 })
      }
    } catch (err) {
      toast.dismiss(toastId)
      if (err.name !== 'AbortError') {
        toast.error('Could not generate PDF. Try Print → Save as PDF instead.')
        console.error('PDF share error:', err)
      }
    } finally {
      setSharing(false)
    }
  }

  days = days?.map(d => ({
    ...d,
    hotspots: Array.isArray(d.hotspots) ? d.hotspots : (Array.isArray(d.Hotspots) ? d.Hotspots : []),
    themes: Array.isArray(d.themes) ? d.themes : (Array.isArray(d.Themes) ? d.Themes : [])
  }))

  // Fallback: read GST & company defaults from localStorage if not on the package
  const savedCompany = JSON.parse(localStorage.getItem('company_defaults') || '{}')

  const co = {
    name: pkg?.company_name || savedCompany.name || 'Shera Travels',
    addr: pkg?.company_addr || savedCompany.addr || '',
    email: pkg?.company_email || savedCompany.email || '',
    phone: pkg?.company_phone || savedCompany.phone || '',
    gst: pkg?.company_gst || savedCompany.gst || '01KODPS7232P1ZE',
  }

  // Unique hotels
  const hotelMap = new Map()
  ;(days || []).forEach(d => {
    if (d.accommodation && !hotelMap.has(d.accommodation)) {
      hotelMap.set(d.accommodation, { name: d.accommodation, star: d.accom_star || 3, photo: d.hotel_photo_url })
    }
  })
  const hotels = [...hotelMap.values()]

  const heroSrc = pkg?.hero_photo_url || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80'
  const inc = pkg?.inclusions || []
  const exc = pkg?.exclusions || []
  const tc = { payment: pkg?.tc_payment || '', cancel: pkg?.tc_cancel || '', notes: pkg?.tc_notes || '' }

  return (
    <div className="preview-overlay open">
      <div className="preview-close-bar">
        <button
          className="close-preview-btn"
          onClick={downloadPdf}
          disabled={sharing}
          style={{ background: '#10B981', color: '#fff', borderColor: '#10B981', opacity: sharing ? 0.6 : 1 }}>
          {sharing ? '⏳ Generating...' : '📥 Download PDF'}
        </button>
        <button className="close-preview-btn" onClick={onPrint}>🖨️ Print</button>
        <button
          className="close-preview-btn"
          onClick={sharePdfOnWhatsApp}
          disabled={sharing}
          style={{ background: 'rgba(37,211,102,0.15)', borderColor: 'rgba(37,211,102,0.4)', color: '#25D366', opacity: sharing ? 0.6 : 1 }}>
          💬 WhatsApp
        </button>
        <button className="close-preview-btn" onClick={onClose}>✕</button>
      </div>

      <div className="preview-doc" id="preview-doc">
        {/* HEADER */}
        <div className="pv-header">
          <div className="pv-logo-area">
            <div className="pv-logo-icon" style={{ background: 'transparent', border: 'none' }}>
              <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div className="pv-company">
              <h1>{co.name}</h1>
              <p>{co.addr}</p>
              {co.gst && <p style={{ fontSize: 10, fontWeight: 700, marginTop: 2 }}>GSTIN: {co.gst}</p>}
            </div>
          </div>
          <div className="pv-contact">
            <div>✉ {co.email}</div>
            <div>📞 {co.phone}</div>
          </div>
        </div>

        {/* CLIENT INFO */}
        {pkg?.client_name && (
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>👤</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>Prepared For</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a' }}>{pkg.client_name}</div>
            </div>
          </div>
        )}

        {/* HERO */}
        <div className="pv-hero">
          <img src={heroSrc} alt="Kashmir" />
          <div className="pv-hero-overlay" />
          <div className="pv-hero-text">
            <h2>{pkg?.title || 'Kashmir Tour Package'}</h2>
            <div className="pv-hero-meta">
              <span>📍 {pkg?.start_location || 'Kashmir, India'}</span>
              <span>🌙 {pkg?.nights || 5} Nights / {pkg?.days || 6} Days</span>
            </div>
            <div className="pv-badges">
              {inc.slice(0, 3).map((item, i) => (
                <span key={i} className="pv-badge">{item}</span>
              ))}
            </div>
          </div>
        </div>

        {/* HOTELS */}
        {hotels.length > 0 && (
          <div className="pv-section">
            <h3>🏨 Accommodation</h3>
            <div className="pv-hotel-cards">
              {hotels.map((h, i) => (
                <div key={i} className="pv-hotel-card">
                  <img className="pv-hotel-img"
                    src={h.photo || 'https://images.unsplash.com/photo-1566837440898-16d0d5e47a7e?w=400&q=80'}
                    alt={h.name}
                  />
                  <div className="pv-hotel-body">
                    <div className="pv-hotel-name">{h.name}</div>
                    <div className="pv-stars">{'★'.repeat(h.star)}{'☆'.repeat(5 - h.star)}</div>
                    <div className="pv-hotel-meta"><span>📍 Kashmir</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INCLUSIONS / EXCLUSIONS */}
        <div className="pv-section pv-two-col">
          <div>
            <h3>✅ Inclusions</h3>
            <ul className="pv-inc-list">
              {inc.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
          <div>
            <h3>❌ Exclusions</h3>
            <ul className="pv-exc-list">
              {exc.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>

        {/* DAY HEADER */}
        {days.length > 0 && (
          <div className="pv-section">
            <h3>📅 Day-wise Itinerary</h3>
          </div>
        )}

        {/* DAYS */}
        {days.map((day, idx) => {
          const photos = (day.day_photos || []).filter(Boolean).sort((a, b) => a.slot_index - b.slot_index)
          const mealList = ['Stay', 'Breakfast', 'Lunch', 'Dinner']
          const titleText = (day.title || '').replace(/^Day \d+:\s*/, '')
          return (
            <div key={day.id || idx} className="pv-day">
              <div className="pv-day-head">
                <span className="pv-day-badge">Day {idx + 1}</span>
                <span className="pv-day-title">{titleText}</span>
              </div>

              {photos.length > 0 && (
                <div style={{ marginTop: 8, marginBottom: 10 }}>
                  <strong className="pv-section-label">📸 Sightseeing Photos</strong>
                  <div className="pv-day-photos" style={{ gridTemplateColumns: `repeat(${Math.min(photos.length, 3)}, 1fr)`, marginTop: 6 }}>
                    {photos.slice(0, 3).map((ph, pi) => (
                      <div key={pi} className="pv-photo-wrap">
                        <img src={ph.photo_url} alt={ph.tag_name || ''} />
                        {ph.tag_name && <div className="pv-photo-caption">{ph.tag_name}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="pv-day-desc">
                {(day.description || '').split('\n').map((line, li) => (
                  <span key={li}>{line}<br /></span>
                ))}
              </p>

              {day.distance && (
                <div className="pv-day-meta"><span>🛣️ {day.distance}</span></div>
              )}

              {(day.hotspots || []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <strong className="pv-section-label">📍 Hotspots</strong>
                  <div className="pv-hotspots" style={{ marginTop: 6 }}>
                    {day.hotspots.map((h, i) => (
                      <span key={i} className="pv-hs-tag" style={{ display: 'inline-flex', alignItems: 'center' }}>
                        {h.toString()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(day.themes || []).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong className="pv-section-label">🎯 Themes</strong>
                  <div className="pv-hotspots" style={{ marginTop: 6 }}>
                    {day.themes.map((t, i) => (
                      <span key={i} className="pv-theme-tag" style={{ display: 'inline-flex', alignItems: 'center' }}>
                        {t.toString()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pv-meals">
                {mealList.map(m => (
                  <span key={m} className={`pv-meal ${(day.meals || []).includes(m) ? 'active' : ''}`}>{m}</span>
                ))}
              </div>

              {day.accommodation && (
                <div className="pv-accom-inline">
                  🏨 <strong>{day.accommodation}</strong> {'★'.repeat(day.accom_star || 3)}
                </div>
              )}
            </div>
          )
        })}

        {/* PRICING */}
        {prices.length > 0 && (
          <div className="pv-section">
            <h3>💰 Price &amp; Rates</h3>
            <table className="pv-price-table">
              <thead>
                <tr>
                  <th>Pax Type</th>
                  <th>Age Limit</th>
                  <th>Price per Pax (INR)</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((r, i) => (
                  <tr key={i}>
                    <td>{r.pax_type}</td>
                    <td>{r.age_limit}</td>
                    <td className="pv-price-highlight">
                      INR {Number(r.price || 0).toLocaleString('en-IN')} / Person (With Tax)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 11, color: 'var(--gray)', marginTop: 8, fontStyle: 'italic' }}>
              *Prices may vary depending on date of travel, hotel availability and seasonal rush.
            </p>
          </div>
        )}

        {/* T&C */}
        {(tc.payment || tc.cancel || tc.notes) && (
          <div className="pv-tc">
            {tc.payment && (
              <>
                <h4>Payment Terms &amp; Methods</h4>
                <p>{tc.payment.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}</p>
              </>
            )}
            {tc.cancel && (
              <>
                <h4>Cancellation &amp; Refund Policy</h4>
                <p>{tc.cancel.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}</p>
              </>
            )}
            {tc.notes && (
              <>
                <h4>Important Notes</h4>
                <p>{tc.notes.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}</p>
              </>
            )}
          </div>
        )}

        {/* FOOTER */}
        <div className="pv-footer">
          <h3>{co.name}</h3>
          <p>{co.addr} &nbsp;|&nbsp; {co.email} &nbsp;|&nbsp; {co.phone}</p>
          {co.gst && <p style={{ marginTop: 4, fontWeight: 700 }}>GSTIN: {co.gst}</p>}
          <p style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
            Shera Travels — Discover Kashmir With Us
          </p>
        </div>
      </div>
    </div>
  )
}
