// Resolve the CRM user (app_users row) behind the caller's Supabase Auth token.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

// Usernames without "@" are mapped to a login email on this domain.
// Keep in sync with STAFF_EMAIL_DOMAIN in src/lib/auth.js.
export const STAFF_EMAIL_DOMAIN = 'staff.dayareharam.com'

export const toAuthEmail = (username: string) => {
  const u = String(username ?? '').trim().toLowerCase()
  return u.includes('@') ? u : `${u.replace(/[^a-z0-9._-]/g, '')}@${STAFF_EMAIL_DOMAIN}`
}

export async function callerAppUser(db: SupabaseClient, req: Request) {
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!jwt) return null
  const { data: { user } } = await db.auth.getUser(jwt)
  if (!user) return null
  const { data } = await db.from('app_users').select('*').eq('auth_id', user.id).maybeSingle()
  if (!data || data.active === false) return null
  return data as { id: string; auth_id: string; username: string; full_name: string; is_admin: boolean; permissions: Record<string, boolean> }
}
