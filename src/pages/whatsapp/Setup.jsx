import toast from 'react-hot-toast'
import { CheckCircle2, XCircle, Copy, RefreshCw, Info } from 'lucide-react'
import { supabaseUrl, isDemo } from '../../lib/supabase'
import { Card } from '../../components/ui'

const SECRETS = [
  { key: 'token', env: 'WHATSAPP_TOKEN', label: 'Permanent access token (System User)' },
  { key: 'phone_number_id', env: 'WHATSAPP_PHONE_NUMBER_ID', label: 'Phone number ID' },
  { key: 'waba_id', env: 'WHATSAPP_WABA_ID', label: 'WhatsApp Business Account ID' },
  { key: 'app_secret', env: 'WHATSAPP_APP_SECRET', label: 'Meta app secret (webhook signature)' },
  { key: 'verify_token', env: 'WHATSAPP_VERIFY_TOKEN', label: 'Webhook verify token (any text)' },
  { key: 'automation_secret', env: 'WA_AUTOMATION_SECRET', label: 'New-lead trigger secret (any text)' },
]

function CopyField({ value }) {
  return (
    <div className="wa-copy">
      <input className="glass-input" readOnly value={value} onFocus={e => e.target.select()} />
      <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(value).then(() => toast.success('Copied'))}><Copy size={14} /> Copy</button>
    </div>
  )
}

export default function Setup({ status, onRefresh, checking }) {
  const base = (supabaseUrl || 'https://<PROJECT_REF>.supabase.co').replace(/\/$/, '')
  const webhookUrl = `${base}/functions/v1/whatsapp-webhook`
  const cfg = status?.config || {}

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {isDemo && (
        <div className="wa-banner info"><Info size={16} />
          The CRM is in demo mode (no Supabase connected), so WhatsApp sends are simulated. Connect Supabase first (Settings → Connect Cloud), then follow these steps.
        </div>
      )}

      <Card title="Connection" subtitle="Status of the WhatsApp Cloud API connection"
        action={<button className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={checking}><RefreshCw size={14} /> {checking ? 'Checking…' : 'Check again'}</button>}>
        {status?.connected ? (
          <div className="wa-banner ok" style={{ marginBottom: 14 }}><CheckCircle2 size={16} />
            Connected as <b>{status.phone?.verified_name}</b> ({status.phone?.display_phone_number}) · quality {status.phone?.quality_rating?.toLowerCase() || 'n/a'}
          </div>
        ) : !isDemo && (
          <div className="wa-banner err" style={{ marginBottom: 14 }}><XCircle size={16} />
            {status?.error || (status?.missing?.length ? `Missing secrets: ${status.missing.join(', ')}` : 'Not connected yet.')}
          </div>
        )}
        {!isDemo && status?.config && (
          <div className="wa-config-grid">
            {SECRETS.map(s => (
              <div key={s.key} className="wa-config-item" title={s.label}>
                {cfg[s.key] ? <CheckCircle2 size={16} color="var(--success)" /> : <XCircle size={16} color="var(--danger)" />}
                <code>{s.env}</code>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Setup steps" subtitle="One-time setup — about 30 minutes. Uses Meta’s official WhatsApp Cloud API.">
        <ol className="wa-setup-list">
          <li>Go to <b>developers.facebook.com</b> → My Apps → Create app → type <b>Business</b> → add the <b>WhatsApp</b> product. Link your Meta Business account.</li>
          <li>In WhatsApp → API Setup, add and verify your business number (it can’t be active in the normal WhatsApp app at the same time). Copy the <b>Phone number ID</b> and <b>WhatsApp Business Account ID</b>.</li>
          <li>Business Settings → Users → <b>System users</b> → add an admin system user → Generate token for your app with <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code> permissions. This token doesn’t expire.</li>
          <li>App settings → Basic → copy the <b>App secret</b>.</li>
          <li>Run <code>supabase-whatsapp.sql</code> in the Supabase SQL editor (replace <code>&lt;PROJECT_REF&gt;</code> and <code>&lt;AUTOMATION_SECRET&gt;</code> at the bottom first).</li>
          <li>Deploy the functions and set the secrets from the project folder (commands are in README.md → WhatsApp setup).</li>
          <li>In Meta → WhatsApp → Configuration → Webhook, paste the callback URL below, enter your verify token, then subscribe to the <b>messages</b> field.</li>
          <li>Create message templates in WhatsApp Manager (e.g. an offer and a welcome template). They appear here once Meta approves them, usually within minutes.</li>
          <li>Add a payment method in WhatsApp Manager — Meta bills each template conversation.</li>
        </ol>
      </Card>

      <Card title="Webhook callback URL" subtitle="Paste this into Meta → WhatsApp → Configuration">
        <CopyField value={webhookUrl} />
      </Card>
    </div>
  )
}
