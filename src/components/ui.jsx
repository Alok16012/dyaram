// Small shared UI building blocks used across pages.
import { ArrowUp, ArrowDown } from 'lucide-react'
import { avatarTone, initials } from '../lib/ui'

export function Pill({ tone = 'gray', children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}

export function Avatar({ name = '', size = 38 }) {
  return (
    <span className="avatar" style={{ ...avatarTone(name), width: size, height: size, fontSize: size * 0.34 }}>
      {initials(name)}
    </span>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  )
}

// KPI card: soft circular icon, label, value and an optional trend line.
export function StatCard({ icon, tone = 'blue', label, value, trend, trendLabel }) {
  const Icon = icon
  const up = trend == null || trend >= 0
  return (
    <div className="kpi-card">
      <div className={`kpi-icon kpi-${tone}`}><Icon size={22} strokeWidth={1.8} /></div>
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        {trend != null && (
          <div className="kpi-trend">
            <span className={up ? 'kpi-up' : 'kpi-down'}>
              {up ? <ArrowUp size={13} strokeWidth={2.4} /> : <ArrowDown size={13} strokeWidth={2.4} />}
              {Math.abs(trend)}%
            </span>
            {trendLabel && <span className="kpi-trend-label">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

export function Card({ title, subtitle, action, children, className = '', bodyClass = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={`card-body ${bodyClass}`}>{children}</div>
    </section>
  )
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty-block">
      {Icon && <div className="empty-block-icon"><Icon size={26} strokeWidth={1.6} /></div>}
      <div className="empty-block-title">{title}</div>
      {text && <div className="empty-block-text">{text}</div>}
      {action}
    </div>
  )
}

// Simple client-side pagination footer.
export function Pagination({ page, pageSize, total, onChange, noun = 'items' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="table-footer pager">
      <span>Showing {from}–{to} of {total} {noun}</span>
      {pages > 1 && (
        <div className="pager-btns">
          <button className="icon-action" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous">‹</button>
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter(n => n === 1 || n === pages || Math.abs(n - page) <= 1)
            .map((n, i, arr) => (
              <span key={n} style={{ display: 'contents' }}>
                {i > 0 && n - arr[i - 1] > 1 && <span className="pager-gap">…</span>}
                <button className={`pager-num ${n === page ? 'active' : ''}`} onClick={() => onChange(n)}>{n}</button>
              </span>
            ))}
          <button className="icon-action" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next">›</button>
        </div>
      )}
    </div>
  )
}
