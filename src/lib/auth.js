import { supabase, isLive } from './supabase'

// ── Permission model ────────────────────────────────────────────────────
// Every module in the sidebar maps to a key here. A user either has
// is_admin = true (full, unrestricted access) or a `permissions` jsonb map
// of { [moduleKey]: boolean } that the admin configures per-user.

// Dashboard ("/") is intentionally excluded — it's always visible to any
// logged-in user, so gating it would risk a redirect loop (the "no access"
// fallback route is "/" itself).
export const MODULES = [
  { key: 'leads',      label: 'Leads',       path: '/leads' },
  { key: 'whatsapp',   label: 'WhatsApp',    path: '/whatsapp' },
  { key: 'bookings',   label: 'Bookings',    path: '/bookings' },
  { key: 'customers',  label: 'Customers',   path: '/customers' },
  { key: 'payments',   label: 'Payments',    path: '/payments' },
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

// ── Supabase Auth (live mode) ───────────────────────────────────────────
// The local session above is only a cache for the UI. Data access is
// enforced by row level security in the database (supabase-security.sql).

// Usernames without "@" log in as <username>@STAFF_EMAIL_DOMAIN.
// Keep in sync with supabase/functions/_shared/auth.ts.
export const STAFF_EMAIL_DOMAIN = 'staff.dayareharam.com'
export const toAuthEmail = (username) => {
  const u = String(username || '').trim().toLowerCase()
  return u.includes('@') ? u : `${u.replace(/[^a-z0-9._-]/g, '')}@${STAFF_EMAIL_DOMAIN}`
}

async function loadAppUser(authId) {
  const { data } = await supabase.from('app_users').select('*').eq('auth_id', authId).maybeSingle()
  return data && data.active !== false ? data : null
}

// Returns the app user on success, or throws with a message for the login form.
export async function signIn(username, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: toAuthEmail(username), password })
  if (error) throw new Error(/invalid|credentials/i.test(error.message) ? 'Invalid ID or Password' : error.message)
  const user = await loadAppUser(data.user.id)
  if (!user) {
    await supabase.auth.signOut()
    throw new Error('This account is inactive or not set up in the CRM')
  }
  return setSession(user)
}

export async function signOut() {
  clearSession()
  if (isLive) await supabase.auth.signOut().catch(() => {})
}

// Called once on app start: re-reads the user's permissions from the
// database so changes made by an admin (or deactivation) apply on reload.
export async function refreshSession() {
  if (!isLive) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { clearSession(); return }
  const user = await loadAppUser(session.user.id)
  if (!user) { await signOut(); return }
  setSession(user)
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
