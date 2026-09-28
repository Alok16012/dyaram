import { usePackage } from '../../context/PackageContext'

export default function TCTab({ active }) {
  const { currentPackage: pkg, updateField } = usePackage()
  if (!pkg) return null

  return (
    <div className={`tab-panel ${active ? 'active' : ''}`}>
      <div className="section-head">Terms &amp; Conditions</div>

      <div className="field">
        <label>Payment Terms</label>
        <textarea
          className="glass-input"
          value={pkg.tc_payment || ''}
          placeholder="e.g. 20% advance required..."
          rows={6}
          onChange={e => updateField('tc_payment', e.target.value)}
        />
      </div>
      <div className="field">
        <label>Cancellation Policy</label>
        <textarea
          className="glass-input"
          value={pkg.tc_cancel || ''}
          placeholder="e.g. Refund after deducting retention amount..."
          rows={6}
          onChange={e => updateField('tc_cancel', e.target.value)}
        />
      </div>
      <div className="field">
        <label>Important Notes</label>
        <textarea
          className="glass-input"
          value={pkg.tc_notes || ''}
          placeholder="e.g. Gondola tickets on own cost..."
          rows={5}
          onChange={e => updateField('tc_notes', e.target.value)}
        />
      </div>

      <div className="section-head">Company Info</div>
      <div className="field">
        <label>Company Name</label>
        <input className="glass-input" value={pkg.company_name || ''} onChange={e => updateField('company_name', e.target.value)} />
      </div>
      <div className="field">
        <label>Address</label>
        <input className="glass-input" value={pkg.company_addr || ''} onChange={e => updateField('company_addr', e.target.value)} />
      </div>
      <div className="field">
        <label>Email</label>
        <input className="glass-input" type="email" value={pkg.company_email || ''} onChange={e => updateField('company_email', e.target.value)} />
      </div>
      <div className="field">
        <label>Phone</label>
        <input className="glass-input" value={pkg.company_phone || ''} onChange={e => updateField('company_phone', e.target.value)} />
      </div>
    </div>
  )
}
