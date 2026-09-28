export default function ComingSoon({ title, icon, description }) {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-bright)', marginBottom: 4 }}>{title}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{description}</p>
      </div>
      <div className="empty-state glass-card">
        <div className="empty-state-icon">{icon}</div>
        <h2>{title} — Coming Soon</h2>
        <p>This feature is being built. Tell us what you need and we'll wire it up.</p>
      </div>
    </div>
  )
}
