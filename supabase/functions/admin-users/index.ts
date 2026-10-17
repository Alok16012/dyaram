// Users & Roles backend: creates / updates / deletes CRM users as Supabase
// Auth users + app_users rows. Only active admins may call it.
import { admin, cors, json } from '../_shared/whatsapp.ts'
import { callerAppUser, toAuthEmail } from '../_shared/auth.ts'

type DB = ReturnType<typeof admin>
const BANNED = '876000h' // ~100 years: how Supabase Auth "deactivates" a user

function profile(body: any) {
  const out: Record<string, unknown> = {}
  if (body.username !== undefined) out.username = String(body.username).trim()
  if (body.full_name !== undefined) out.full_name = String(body.full_name).trim()
  if (body.role !== undefined) out.role = String(body.role || 'Staff').trim()
  if (body.is_admin !== undefined) out.is_admin = !!body.is_admin
  if (body.permissions !== undefined) out.permissions = body.is_admin ? {} : (body.permissions ?? {})
  if (body.active !== undefined) out.active = !!body.active
  return out
}

async function createUser(db: DB, body: any) {
  const username = String(body.username ?? '').trim()
  const password = String(body.password ?? '')
  if (!username || !body.full_name) throw new Error('Username and full name are required')
  if (password.length < 6) throw new Error('Password must be at least 6 characters')
  const { data: exists } = await db.from('app_users').select('id').ilike('username', username).maybeSingle()
  if (exists) throw new Error('Username already exists')

  const { data: created, error } = await db.auth.admin.createUser({
    email: toAuthEmail(username), password, email_confirm: true,
    ...(body.active === false ? { ban_duration: BANNED } : {}),
  })
  if (error) throw new Error(error.message)
  const { data: row, error: rowErr } = await db.from('app_users')
    .insert({ ...profile(body), username, auth_id: created.user.id, active: body.active !== false })
    .select('*').single()
  if (rowErr) {
    await db.auth.admin.deleteUser(created.user.id)
    throw new Error(rowErr.message)
  }
  return row
}

async function updateUser(db: DB, me: { id: string }, body: any) {
  const { data: target } = await db.from('app_users').select('*').eq('id', body.id).maybeSingle()
  if (!target) throw new Error('User not found')
  const changes = profile(body)
  if (target.id === me.id && (changes.active === false || changes.is_admin === false)) {
    throw new Error("You can't deactivate or remove admin from your own account")
  }
  if (changes.username && String(changes.username).toLowerCase() !== target.username.toLowerCase()) {
    const { data: clash } = await db.from('app_users').select('id').ilike('username', String(changes.username)).neq('id', target.id).maybeSingle()
    if (clash) throw new Error('Username already exists')
  }

  // Older rows created before Supabase Auth have no auth_id yet: create one.
  let authId: string | null = target.auth_id
  if (!authId) {
    if (!body.password) throw new Error('Set a password for this user to enable their login')
    const { data: created, error } = await db.auth.admin.createUser({
      email: toAuthEmail(String(changes.username ?? target.username)), password: String(body.password), email_confirm: true,
    })
    if (error) throw new Error(error.message)
    authId = created.user.id
  } else {
    const attrs: Record<string, unknown> = {}
    if (body.password) {
      if (String(body.password).length < 6) throw new Error('Password must be at least 6 characters')
      attrs.password = String(body.password)
    }
    if (changes.username) attrs.email = toAuthEmail(String(changes.username))
    if (changes.active !== undefined) attrs.ban_duration = changes.active ? 'none' : BANNED
    if (Object.keys(attrs).length) {
      const { error } = await db.auth.admin.updateUserById(authId, { ...attrs, email_confirm: true })
      if (error) throw new Error(error.message)
    }
  }

  const { data: row, error } = await db.from('app_users')
    .update({ ...changes, auth_id: authId, password_hash: null, updated_at: new Date().toISOString() })
    .eq('id', target.id).select('*').single()
  if (error) throw new Error(error.message)
  // Deactivating should also end their current sessions.
  if (changes.active === false && authId) await db.auth.admin.signOut(authId, 'global').catch(() => {})
  return row
}

async function deleteUser(db: DB, me: { id: string }, id: string) {
  if (id === me.id) throw new Error("You can't delete your own account")
  const { data: target } = await db.from('app_users').select('id, auth_id').eq('id', id).maybeSingle()
  if (!target) throw new Error('User not found')
  const { error } = await db.from('app_users').delete().eq('id', id)
  if (error) throw new Error(error.message)
  if (target.auth_id) await db.auth.admin.deleteUser(target.auth_id)
  return { deleted: id }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const db = admin()
    const me = await callerAppUser(db, req)
    if (!me?.is_admin) return json({ error: 'Only admins can manage users' }, 403)
    const body = await req.json().catch(() => ({}))
    let result: unknown
    switch (body.action) {
      case 'create': result = await createUser(db, body); break
      case 'update': result = await updateUser(db, me, body); break
      case 'delete': result = await deleteUser(db, me, body.id); break
      default: return json({ error: `Unknown action: ${body.action}` }, 400)
    }
    await db.from('audit_logs').insert({
      actor: me.full_name || me.username,
      action: { create: 'Create User', update: 'Update User', delete: 'Delete User' }[body.action as string],
      details: `${body.action} user ${body.username ?? body.id}`,
    })
    return json({ user: result })
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 400)
  }
})
