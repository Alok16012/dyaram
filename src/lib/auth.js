// ── Permission model ────────────────────────────────────────────────────
// Every module in the sidebar maps to a key here. A user either has
// is_admin = true (full, unrestricted access) or a `permissions` jsonb map
// of { [moduleKey]: boolean } that the admin configures per-user.

// Dashboard ("/") is intentionally excluded — it's always visible to any
// logged-in user, so gating it would risk a redirect loop (the "no access"
// fallback route is "/" itself).
export const MODULES = [
  { key: 'leads',      label: 'Leads',       path: '/leads' },
  { key: 'bookings',   label: 'Bookings',    path: '/bookings' },
  { key: 'itinerary',  label: 'Itinerary',   path: '/itinerary' },
  { key: 'invoices',   label: 'Invoices',    path: '/invoices' },
  { key: 'hotels',     label: 'Hotels',      path: '/hotels' },
  { key: 'cabs',       label: 'Cabs',        path: '/cabs' },
  { key: 'photos',     label: 'Photos',      path: '/photos' },
  { key: 'income',     label: 'Income',      path: '/income' },
  { key: 'expenses',   label: 'Expenses',    path: '/expenses' },
  { key: 'audit_logs', label: 'Audit Logs',  path: '/audit-logs' },
  { key: 'admin',      label: 'Settings',    path: '/admin' },
]

const SESSION_KEY = 'shara_session'

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

export function setSession(user) {
  const session = {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    is_admin: !!user.is_admin,
    permissions: user.permissions || {},
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  localStorage.setItem('shara_auth', 'true')
  return session
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('shara_auth')
}

export function isLoggedIn() {
  return localStorage.getItem('shara_auth') === 'true' && !!getSession()
}

export function isAdmin() {
  return !!getSession()?.is_admin
}

export function hasAccess(moduleKey) {
  const session = getSession()
  if (!session) return false
  if (session.is_admin) return true
  return !!session.permissions?.[moduleKey]
}
